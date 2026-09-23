sigma2 = 3;

X = zeros(1,100);
for i =1:100
    X(i) = normrnd(0,sigma2);
end

disp(mean(X))

% 浏览器根据返回的 X 绘图；数值计算保持不变。
