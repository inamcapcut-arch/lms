import json
import sys
import os
import subprocess
import time
import threading
import resource

def set_limits(memory_limit_bytes):
    # Set Address Space limit (Virtual Memory)
    try:
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit_bytes, memory_limit_bytes))
    except Exception as e:
        sys.stderr.write(f"Warning setting RLIMIT_AS: {e}\n")

def run_testcase(cmd, input_data, timeout_ms, memory_limit_bytes):
    limit = 10 * 1024 # 10KB stream limit
    stdout_chunks = []
    stderr_chunks = []
    stdout_len = [0]
    stderr_len = [0]
    
    start_time = time.time()
    proc = None
    timed_out = False
    
    try:
        # Spawn child process
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=lambda: set_limits(memory_limit_bytes),
            text=True
        )
    except Exception as e:
        return "", f"Failed to spawn process: {e}", "SYSTEM_ERROR", 0, 0

    # Write stdin in a separate thread to prevent blocking
    def write_input():
        try:
            if input_data:
                proc.stdin.write(input_data)
            proc.stdin.close()
        except Exception:
            pass

    writer_thread = threading.Thread(target=write_input)
    writer_thread.start()

    # Read streams in threads to enforce size limits dynamically
    def read_stream(stream, chunks_list, len_ref):
        try:
            while True:
                chunk = stream.read(1024)
                if not chunk:
                    break
                chunks_list.append(chunk)
                len_ref[0] += len(chunk.encode('utf-8', errors='ignore'))
                if len_ref[0] > limit:
                    if proc:
                        proc.kill()
                    break
        except Exception:
            pass

    t_stdout = threading.Thread(target=read_stream, args=(proc.stdout, stdout_chunks, stdout_len))
    t_stderr = threading.Thread(target=read_stream, args=(proc.stderr, stderr_chunks, stderr_len))
    
    t_stdout.start()
    t_stderr.start()

    # Poll process and check timeout
    timeout_seconds = timeout_ms / 1000.0
    while proc.poll() is None:
        elapsed = time.time() - start_time
        if elapsed > timeout_seconds:
            timed_out = True
            proc.kill()
            break
        time.sleep(0.005)

    writer_thread.join(0.5)
    t_stdout.join(0.5)
    t_stderr.join(0.5)

    elapsed_ms = int((time.time() - start_time) * 1000)
    exit_code = proc.returncode

    # Read child usage
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    memory_used_kb = usage.ru_maxrss

    stdout_str = "".join(stdout_chunks)
    stderr_str = "".join(stderr_chunks)

    # Truncate if limits exceeded
    if stdout_len[0] > limit:
        stdout_str = stdout_str[:limit] + "\n[Stdout truncated]"
        status = "WRONG_ANSWER"
    elif stderr_len[0] > limit:
        stderr_str = stderr_str[:limit] + "\n[Stderr truncated]"
        status = "RUNTIME_ERROR"
    elif timed_out:
        status = "TIME_LIMIT_EXCEEDED"
    elif exit_code != 0:
        # Check if terminated by signal (OOM usually SIGSEGV/SIGKILL/SIGABRT)
        # Or if resource limit was hit (AS limit causes memory errors/segfaults)
        # If memory usage is close to the limit, mark as MLE
        if memory_used_kb * 1024 >= memory_limit_bytes * 0.9:
            status = "MEMORY_LIMIT_EXCEEDED"
        else:
            status = "RUNTIME_ERROR"
    else:
        status = "ACCEPTED"

    return stdout_str, stderr_str, status, elapsed_ms, memory_used_kb

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sandbox_runner.py <config_json_path>")
        sys.exit(1)

    config_path = sys.argv[1]
    with open(config_path, 'r') as f:
        config = json.load(f)

    language = config.get("language")
    compile_cmd = config.get("compileCmd")
    run_cmd = config.get("runCmd")
    test_cases = config.get("testCases", [])
    time_limit_ms = config.get("timeLimitMs", 2000)
    memory_limit_kb = config.get("memoryLimitKb", 262144)
    memory_limit_bytes = memory_limit_kb * 1024

    # 1. Compilation
    if compile_cmd:
        start_time = time.time()
        try:
            # We also set a limit on compilation (max 20KB logs, 10s timeout)
            comp_proc = subprocess.Popen(
                compile_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=True
            )
            # Read compile outputs up to 20KB
            comp_stdout, comp_stderr = comp_proc.communicate(timeout=10.0)
            comp_code = comp_proc.returncode
            
            compile_logs = (comp_stdout + "\n" + comp_stderr).strip()
            if len(compile_logs.encode('utf-8')) > 20 * 1024:
                compile_logs = compile_logs[:20 * 1024] + "\n[Compilation logs truncated]"

            if comp_code != 0:
                result = {
                    "status": "COMPILATION_ERROR",
                    "compileOutput": compile_logs,
                    "testResults": []
                }
                with open("/workspace/results.json", "w") as out:
                    json.dump(result, out)
                sys.exit(0)
        except subprocess.TimeoutExpired as e:
            if comp_proc:
                comp_proc.kill()
            result = {
                "status": "COMPILATION_ERROR",
                "compileOutput": "Compilation timed out after 10 seconds.",
                "testResults": []
            }
            with open("/workspace/results.json", "w") as out:
                json.dump(result, out)
            sys.exit(0)
        except Exception as e:
            result = {
                "status": "COMPILATION_ERROR",
                "compileOutput": f"Compilation failed: {e}",
                "testResults": []
            }
            with open("/workspace/results.json", "w") as out:
                json.dump(result, out)
            sys.exit(0)

    # 2. Execution Loop
    results = []
    overall_status = "ACCEPTED"
    max_time_ms = 0
    max_memory_kb = 0
    passed_count = 0
    failed_count = 0

    for tc in test_cases:
        tc_id = tc.get("id")
        input_data = tc.get("input", "")
        expected = tc.get("expectedOutput")

        stdout, stderr, status, elapsed_ms, memory_kb = run_testcase(
            run_cmd, input_data, time_limit_ms, memory_limit_bytes
        )

        max_time_ms = max(max_time_ms, elapsed_ms)
        max_memory_kb = max(max_memory_kb, memory_kb)

        # Output verification (trim trailing whitespace/newlines)
        passed = False
        if status == "ACCEPTED":
            # Compare stdout with expected output if expected is present
            if expected is not None:
                passed = (stdout.strip() == expected.strip())
                if not passed:
                    status = "WRONG_ANSWER"
            else:
                # Custom runs without expected output are treated as passed if they didn't crash
                passed = True

        if passed:
            passed_count += 1
        else:
            failed_count += 1
            # Propagate the first non-accepted status as the overall status
            if overall_status == "ACCEPTED":
                overall_status = status

        results.append({
            "testCaseId": tc_id,
            "passed": passed,
            "status": status,
            "stdout": stdout,
            "stderr": stderr,
            "executionTimeMs": elapsed_ms,
            "memoryUsedKb": memory_kb
        })

    # Final overall evaluation status
    if overall_status == "ACCEPTED" and failed_count > 0:
        overall_status = "WRONG_ANSWER"

    final_payload = {
        "status": overall_status,
        "passedCount": passed_count,
        "failedCount": failed_count,
        "executionTimeMs": max_time_ms,
        "memoryUsedKb": max_memory_kb,
        "testResults": results
    }

    with open("/workspace/results.json", "w") as out:
        json.dump(final_payload, out)

if __name__ == "__main__":
    main()
