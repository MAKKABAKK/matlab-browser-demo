% 使用 MATLAB 生成浏览器执行结果的独立数值基准，并检查算法适配。
rootDir = fileparts(fileparts(mfilename('fullpath')));
addpath(fullfile(rootDir, 'matlab'));
cases = [61, 300, 0.20; 11, 1, 0.01; 81, 500, 0.25; 31, 100, 0.10];
outputs = cell(size(cases, 1), 1);
for k = 1:size(cases, 1)
    outputs{k} = heat_demo(cases(k, 1), cases(k, 2), cases(k, 3));
end
fixtureDir = fullfile(rootDir, 'tests', 'fixtures');
if ~isfolder(fixtureDir)
    mkdir(fixtureDir);
end
fid = fopen(fullfile(fixtureDir, 'matlab-reference.json'), 'w');
assert(fid ~= -1, 'Cannot create reference fixture.');
fprintf(fid, '%s\n', jsonencode(struct('matlabRelease', version('-release'), 'cases', {outputs})));
fclose(fid);
files = dir(fullfile(rootDir, 'matlab', '*.m'));
for k = 1:numel(files)
    issues = checkcode(fullfile(files(k).folder, files(k).name), '-id');
    assert(isempty(issues), 'MATLAB code analysis failed: %s', files(k).name);
end
disp('MATLAB reference generated: four parameter cases; code analysis passed.');
