"""通过 Playwright CLI 运行真实浏览器验收，不依赖 Playwright 测试框架。"""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--browser', choices=['chrome', 'webkit'], default='chrome')
parser.add_argument('--url', default='http://127.0.0.1:4173/matlab-browser-demo/')
parser.add_argument('--suite', choices=['heat', 'random', 'marginal'], default='heat')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
remote = args.url.startswith('https://')
output = root / 'output' / 'playwright' / (args.browser + ('-' + args.suite if args.suite != 'heat' else '') + ('-remote' if remote else ''))
output.mkdir(parents=True, exist_ok=True)
cli = ['npx', '--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=' + args.suite + '-' + args.browser + ('-remote' if remote else '')]

def run(*arguments):
    result = subprocess.run(cli + list(arguments), cwd=root, text=True, capture_output=True)
    with (output / 'cli.log').open('a') as handle:
        handle.write(result.stdout + result.stderr + '\n')
    if result.returncode:
        raise SystemExit(result.stdout + result.stderr)
    return result.stdout

run('open', args.url, '--browser', args.browser)
source = (root / 'tests' / (args.suite + '-browser-checks.js' if args.suite != 'heat' else 'browser-checks.js')).read_text()
source = source.replace('__BASE_URL__', json.dumps(args.url))
source = source.replace('__FIXTURE_PATH__', json.dumps(str(root / 'tests/fixtures/matlab-reference.json')))
source = source.replace('__OUTPUT_DIR__', json.dumps(str(output)))
run('run-code', source)
raw = run('--raw', 'eval', 'JSON.stringify(window.__qaReport)')
try:
    report = json.loads(raw)
    if isinstance(report, str):
        report = json.loads(report)
except json.JSONDecodeError:
    raise SystemExit('Cannot read browser report. See ' + str(output / 'cli.log'))
report['url'] = args.url
report['suite'] = args.suite
(output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: report.get(key) for key in ['passed', 'failure', 'checks', 'numeric']}, ensure_ascii=False, indent=2))
raise SystemExit(0 if report.get('passed') else 1)
