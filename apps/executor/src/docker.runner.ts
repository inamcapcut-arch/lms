import Docker from 'dockerode';
import fs from 'fs';
import path from 'path';

const docker = new Docker();

export interface TestCasePayload {
  id: string;
  input: string;
  expectedOutput: string | null;
}

export interface TestCaseResultPayload {
  testCaseId: string;
  passed: boolean;
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'RUNTIME_ERROR' | 'SYSTEM_ERROR';
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryUsedKb: number;
}

export interface SubmissionExecutionResult {
  status: 'ACCEPTED' | 'WRONG_ANSWER' | 'RUNTIME_ERROR' | 'COMPILATION_ERROR' | 'TIME_LIMIT_EXCEEDED' | 'MEMORY_LIMIT_EXCEEDED' | 'SYSTEM_ERROR';
  compileOutput?: string;
  passedCount: number;
  failedCount: number;
  executionTimeMs: number;
  memoryUsedKb: number;
  testResults: TestCaseResultPayload[];
}

interface LanguageConfig {
  extension: string;
  imageName: string;
  compileCmd: string[] | null;
  runCmd: string[];
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  python: {
    extension: 'py',
    imageName: 'alex-python-runner:3.12.3',
    compileCmd: null,
    runCmd: ['python3', '/workspace/build/Solution.py'],
  },
  c: {
    extension: 'c',
    imageName: 'alex-cpp-runner:13',
    compileCmd: ['gcc', '-O2', '-std=c11', '/workspace/build/Solution.c', '-o', '/workspace/build/Solution', '-lm'],
    runCmd: ['/workspace/build/Solution'],
  },
  cpp: {
    extension: 'cpp',
    imageName: 'alex-cpp-runner:13',
    compileCmd: ['g++', '-O2', '-std=c++17', '/workspace/build/Solution.cpp', '-o', '/workspace/build/Solution', '-lm'],
    runCmd: ['/workspace/build/Solution'],
  },
  java: {
    extension: 'java',
    imageName: 'alex-java-runner:21',
    compileCmd: ['javac', '/workspace/build/Solution.java'],
    runCmd: ['java', '-XX:+UseSerialGC', '-Xmx192m', '-cp', '/workspace/build', 'Solution'],
  },
  javascript: {
    extension: 'js',
    imageName: 'alex-node-runner:22',
    compileCmd: null,
    runCmd: ['node', '/workspace/build/Solution.js'],
  },
  typescript: {
    extension: 'ts',
    imageName: 'alex-node-runner:22',
    compileCmd: ['tsc', '--target', 'es2020', '--module', 'commonjs', '/workspace/build/Solution.ts'],
    runCmd: ['node', '/workspace/build/Solution.js'],
  },
};

// Python runner script content embedded as a string to guarantee self-containment
const RUNNER_SCRIPT_CONTENT = `import json
import sys
import os
import subprocess
import time
import threading
import shutil
import pwd

def demote(uid, gid):
    def set_ids():
        try:
            if gid is not None:
                os.setgid(gid)
            if uid is not None:
                os.setuid(uid)
        except Exception:
            pass
    return set_ids

def run_testcase(cmd, input_data, timeout_ms, sandbox_uid, sandbox_gid, build_dir):
    limit = 10 * 1024 # 10KB stream limit
    stdout_chunks = []
    stderr_chunks = []
    stdout_len = [0]
    stderr_len = [0]
    
    start_time = time.time()
    proc = None
    timed_out = False
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            preexec_fn=demote(sandbox_uid, sandbox_gid),
            cwd=build_dir,
            text=True
        )
    except Exception as e:
        return "", f"Failed to spawn process: {e}", "SYSTEM_ERROR", 0, 0

    def write_input():
        try:
            if input_data:
                proc.stdin.write(input_data)
            proc.stdin.close()
        except Exception:
            pass

    writer_thread = threading.Thread(target=write_input)
    writer_thread.start()

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

    memory_used_kb = 0
    try:
        import resource
        usage_children = resource.getrusage(resource.RUSAGE_CHILDREN)
        memory_used_kb = usage_children.ru_maxrss
    except Exception:
        pass

    stdout_str = "".join(stdout_chunks)
    stderr_str = "".join(stderr_chunks)

    if stdout_len[0] > limit:
        stdout_str = stdout_str[:limit] + "\\n[Stdout truncated]"
        status = "WRONG_ANSWER"
    elif stderr_len[0] > limit:
        stderr_str = stderr_str[:limit] + "\\n[Stderr truncated]"
        status = "RUNTIME_ERROR"
    elif timed_out:
        status = "TIME_LIMIT_EXCEEDED"
    elif exit_code != 0:
        if exit_code in [-9, -15, 137]:
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

    try:
        sandbox_user = pwd.getpwnam('sandbox')
        sandbox_uid = sandbox_user.pw_uid
        sandbox_gid = sandbox_user.pw_gid
    except Exception:
        sandbox_uid = 1000
        sandbox_gid = 1000

    build_dir = '/workspace/build'
    try:
        os.makedirs(build_dir, exist_ok=True)
        for item in os.listdir('/workspace'):
            if item.startswith('Solution.'):
                src = os.path.join('/workspace', item)
                dst = os.path.join(build_dir, item)
                shutil.move(src, dst)
        
        os.chown(build_dir, sandbox_uid, sandbox_gid)
        for root, dirs, files in os.walk(build_dir):
            for d in dirs:
                os.chown(os.path.join(root, d), sandbox_uid, sandbox_gid)
            for f in files:
                os.chown(os.path.join(root, f), sandbox_uid, sandbox_gid)
    except Exception as e:
        sys.stderr.write(f"Warning setting up build dir: {e}\\n")

    if compile_cmd:
        try:
            comp_proc = subprocess.Popen(
                compile_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=demote(sandbox_uid, sandbox_gid),
                cwd=build_dir,
                text=True
            )
            comp_stdout, comp_stderr = comp_proc.communicate(timeout=15.0)
            comp_code = comp_proc.returncode
            
            compile_logs = (comp_stdout + "\\n" + comp_stderr).strip()
            if len(compile_logs.encode('utf-8')) > 20 * 1024:
                compile_logs = compile_logs[:20 * 1024] + "\\n[Compilation logs truncated]"

            if comp_code != 0:
                result = {
                    "status": "COMPILATION_ERROR",
                    "compileOutput": compile_logs,
                    "passedCount": 0,
                    "failedCount": len(test_cases),
                    "executionTimeMs": 0,
                    "memoryUsedKb": 0,
                    "testResults": []
                }
                with open("/workspace/results.json", "w") as out:
                    json.dump(result, out)
                sys.exit(0)
        except subprocess.TimeoutExpired:
            if comp_proc:
                comp_proc.kill()
            result = {
                "status": "COMPILATION_ERROR",
                "compileOutput": "Compilation timed out after 15 seconds.",
                "passedCount": 0,
                "failedCount": len(test_cases),
                "executionTimeMs": 0,
                "memoryUsedKb": 0,
                "testResults": []
            }
            with open("/workspace/results.json", "w") as out:
                json.dump(result, out)
            sys.exit(0)
        except Exception as e:
            result = {
                "status": "COMPILATION_ERROR",
                "compileOutput": f"Compilation failed: {e}",
                "passedCount": 0,
                "failedCount": len(test_cases),
                "executionTimeMs": 0,
                "memoryUsedKb": 0,
                "testResults": []
            }
            with open("/workspace/results.json", "w") as out:
                json.dump(result, out)
            sys.exit(0)

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
            run_cmd, input_data, time_limit_ms, sandbox_uid, sandbox_gid, build_dir
        )

        max_time_ms = max(max_time_ms, elapsed_ms)
        max_memory_kb = max(max_memory_kb, memory_kb)

        passed = False
        if status == "ACCEPTED":
            if expected is not None:
                passed = (stdout.strip() == expected.strip())
                if not passed:
                    status = "WRONG_ANSWER"
            else:
                passed = True

        if passed:
            passed_count += 1
        else:
            failed_count += 1
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
`;

export const pullImageIfNotExists = async (imageName: string) => {
  const images = await docker.listImages();
  if (!images.some(img => img.RepoTags?.includes(imageName))) {
    console.log(`Pulling image ${imageName}...`);
    await new Promise((resolve, reject) => {
      docker.pull(imageName, (err: any, stream: any) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, onFinished);
        function onFinished(err: any, output: any) {
          if (err) return reject(err);
          resolve(output);
        }
      });
    });
    console.log(`Image ${imageName} pulled.`);
  }
};

export const verifySandboxRuntime = async () => {
  const runtime = process.env.SANDBOX_RUNTIME || (process.env.NODE_ENV === 'production' ? 'runsc' : 'default');
  if (runtime === 'runsc') {
    try {
      const dockerInfo = await docker.info();
      const hasGVisor = dockerInfo.Runtimes && (dockerInfo.Runtimes.runsc || dockerInfo.Runtimes.gvisor);
      if (!hasGVisor) {
        throw new Error("gVisor ('runsc' or 'gvisor') runtime is not registered in Docker. Untrusted code execution without sandbox isolation is disabled in production.");
      }
      console.log("gVisor sandbox runtime verified successfully.");
    } catch (err: any) {
      console.error("Failed to verify gVisor runtime:", err.message);
      throw err;
    }
  } else {
    console.warn(`Running in development mode with '${runtime}' Docker runtime.`);
  }
};

export const executeCodeInContainer = async (
  jobId: string,
  language: string,
  code: string,
  testCases: TestCasePayload[],
  timeLimitMs: number = 2000,
  memoryLimitKb: number = 262144 // 256MB default
): Promise<SubmissionExecutionResult> => {
  const limitBytes = code ? Buffer.byteLength(code, 'utf8') : 0;
  if (limitBytes > 512 * 1024) {
    return {
      status: 'SYSTEM_ERROR',
      compileOutput: 'Code size limit exceeded (512KB max).',
      passedCount: 0,
      failedCount: testCases.length,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      testResults: [],
    };
  }

  const config = LANGUAGE_CONFIGS[language.toLowerCase()];
  if (!config) {
    return {
      status: 'SYSTEM_ERROR',
      compileOutput: `Unsupported language: ${language}`,
      passedCount: 0,
      failedCount: testCases.length,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      testResults: [],
    };
  }

  const workspacePath = path.resolve(process.cwd(), 'temp-sandbox', jobId);
  fs.mkdirSync(workspacePath, { recursive: true });

  let container: Docker.Container | null = null;

  try {
    const codeFileName = `Solution.${config.extension}`;
    fs.writeFileSync(path.join(workspacePath, codeFileName), code, 'utf8');
    fs.writeFileSync(path.join(workspacePath, 'sandbox_runner.py'), RUNNER_SCRIPT_CONTENT, 'utf8');

    const runConfig = {
      language,
      compileCmd: config.compileCmd,
      runCmd: config.runCmd,
      testCases: testCases.map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
      timeLimitMs,
      memoryLimitKb,
    };
    fs.writeFileSync(path.join(workspacePath, 'testcases.json'), JSON.stringify(runConfig, null, 2), 'utf8');

    await pullImageIfNotExists(config.imageName);

    const hostConfig: Docker.HostConfig = {
      Memory: memoryLimitKb * 1024,
      MemorySwap: memoryLimitKb * 1024,
      CpuQuota: 50000, // 0.5 CPU core limit
      NetworkMode: 'none', // Strict network disabling
      PidsLimit: 32,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges'],
      Binds: [
        process.platform === 'win32'
          ? `${workspacePath.replace(/\\/g, '/')}:/workspace:rw`
          : `${workspacePath}:/workspace:rw,nosuid`
      ],
    };

    const sandboxRuntime = process.env.SANDBOX_RUNTIME || (process.env.NODE_ENV === 'production' ? 'runsc' : 'default');
    if (sandboxRuntime === 'runsc') {
      (hostConfig as any).Runtime = 'runsc';
    }

    container = await docker.createContainer({
      Image: config.imageName,
      User: 'root', // Force wrapper execution as root to set build permissions
      Cmd: ['python3', '/workspace/sandbox_runner.py', '/workspace/testcases.json'],
      HostConfig: hostConfig,
      WorkingDir: '/workspace',
    });

    await container.start();

    let exited = false;
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => {
        if (!exited) {
          if (container) {
            container.kill().catch(() => {});
          }
          reject(new Error('Sandbox execution timed out.'));
        }
      }, 15000)
    );

    const waitPromise = container.wait().then(() => {
      exited = true;
    });

    await Promise.race([waitPromise, timeoutPromise]);

    const resultsFilePath = path.join(workspacePath, 'results.json');
    if (!fs.existsSync(resultsFilePath)) {
      let logMsg = '';
      try {
        const logs = await container.logs({ stdout: true, stderr: true });
        logMsg = logs.toString('utf8');
      } catch (err: any) {
        logMsg = `Failed to get logs: ${err.message}`;
      }
      throw new Error(`Sandbox did not produce results. Container Output:\n${logMsg}`);
    }

    const resultsData = fs.readFileSync(resultsFilePath, 'utf8');
    const resultObj: SubmissionExecutionResult = JSON.parse(resultsData);

    return resultObj;
  } catch (error: any) {
    console.error(`Execution error for Job ${jobId}: ${error.message}`);
    return {
      status: 'SYSTEM_ERROR',
      compileOutput: `Execution error: ${error.message}`,
      passedCount: 0,
      failedCount: testCases.length,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      testResults: [],
    };
  } finally {
    if (container) {
      await container.remove({ force: true }).catch((err) => {
        console.error(`Failed to remove container ${jobId}: ${err.message}`);
      });
    }

    try {
      if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }
    } catch (err: any) {
      console.error(`Failed to clean workspace directory: ${workspacePath}. Error: ${err.message}`);
    }
  }
};
