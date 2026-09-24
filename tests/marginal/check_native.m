root = fileparts(fileparts(fileparts(mfilename('fullpath'))));
addpath(fullfile(root,'matlab')); addpath(fullfile(root,'tests','marginal'));
cases = [12,8,1,1,30; 40,10,0.3,2,10; 600,20,1,1,30];
for i=1:size(cases,1)
    p=num2cell(cases(i,:));
    rng(170+i); expected=marginal_reference(p{:});
    rng(170+i); actual=Marginal_FullCollapsed_browser(p{:});
    fields=fieldnames(expected);
    for j=1:numel(fields)
        key=fields{j}; a=actual.(key); b=expected.(key);
        assert(isequal(size(a),size(b)),key);
        assert(all(abs(a(:)-b(:))<1e-8+1e-8*abs(b(:))),key);
    end
    fprintf('PASS original vs incremental: N=%d iterations=%d\n',p{1},p{2});
end
