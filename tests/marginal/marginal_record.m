function value = marginal_record(kind,a,b)
global marginal_draws
if kind==1
    value=rand;
elseif kind==2
    value=normrnd(a,b);
else
    value=gamrnd(a,b);
end
marginal_draws(end+1,:)=[kind,a,b,value];
end
