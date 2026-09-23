root=fileparts(fileparts(mfilename('fullpath')));
folder=fullfile(root,'tests','marginal'); addpath(folder);
output=fullfile(root,'output','marginal-reference'); if ~isfolder(output); mkdir(output); end
text=fileread(fullfile(folder,'marginal_reference.m'));
text=strrep(text,'function result = marginal_reference(', 'function result = recorded_reference(');
text=strrep(text,'normrnd(', 'marginal_record(2,');
text=strrep(text,'gamrnd(', 'marginal_record(3,');
text=regexprep(text,'\<rand\>', 'marginal_record(1,0,0)');
fid=fopen(fullfile(output,'recorded_reference.m'),'w'); fwrite(fid,text); fclose(fid); addpath(output);
params=[12,8,1,1,30;40,10,0.3,2,10;4,1,0.001,100,0.01;20,5,100,0.01,1000];
cases=cell(1,size(params,1)); global marginal_draws
for i=1:size(params,1)
    marginal_draws=zeros(0,4); rng(170+i); p=num2cell(params(i,:));
    expected=recorded_reference(p{:});
    inputs=struct('N',p{1},'ChainLength',p{2},'alpha',p{3},'sigmaX2',p{4},'A2',p{5});
    cases{i}=struct('params',inputs,'expected',expected,'draws',marginal_draws);
end
fixture=struct('matlabRelease',version('-release'),'description','Original full-scan algorithm with equivalent categorical and Beta construction; each draw records kind, parameters, value.','cases',{cases});
fid=fopen(fullfile(root,'tests','fixtures','marginal-reference.json'),'w'); fwrite(fid,jsonencode(fixture)); fclose(fid);
fprintf('Generated %d recorded MATLAB reference cases.\n',numel(cases));
