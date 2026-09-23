sigma2 = 3;

X = zeros(1,100);
for i =1:100
    X(i) = normrnd(0,sigma2);
end

disp(mean(X))

plot(X)
