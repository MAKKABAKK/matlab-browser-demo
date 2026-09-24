function result = Marginal_FullCollapsed_browser(N, ChainLength, alpha, sigmaX2, A2)
% Browser adaptation: same collapsed allocation and alpha-update formulas.
% Maintain cluster counts/sums instead of rescanning all N observations.
X = zeros(1,N);
truemean = [-5,0,5];
for n = 1:N
    index = min(3, floor(3*rand)+1);
    X(n) = normrnd(truemean(index),1);
end
X = gather(sort(X));
Table = zeros(1,N);
counts = zeros(1,N);
sums = zeros(1,N);
K = 0;
AlphaS = zeros(1,ChainLength+1);
ClusterS = zeros(1,ChainLength+1);
for iter = 1:ChainLength
    for n = 1:N
        old = gather(Table(n));
        xn = gather(X(n));
        Table(n) = 0;
        if old > 0
            counts(old) = counts(old)-1;
            sums(old) = sums(old)-xn;
            if gather(counts(old)) == 0
                for k = old:(K-1)
                    counts(k) = counts(k+1);
                    sums(k) = sums(k+1);
                end
                counts(K) = 0;
                sums(K) = 0;
                Table(Table > old) = Table(Table > old)-1;
                K = K-1;
            end
        end
        logProb = zeros(1,N+1);
        for k = 1:K
            count = gather(counts(k));
            sumX = gather(sums(k));
            Mk = A2 .* (xn + sumX) ./ ((count+1).*A2 + sigmaX2);
            Sk2 = sigmaX2 .* A2 ./ ((count+1).*A2 + sigmaX2);
            Uk = A2 .* sumX ./ (count.*A2 + sigmaX2);
            Vk2 = sigmaX2 .* A2 ./ (count.*A2 + sigmaX2);
            logLike = -0.5.*log(2.*pi.*sigmaX2) - xn.^2./(2.*sigmaX2) ...
                + 0.5.*log(2.*pi.*Sk2) + Mk.^2./(2.*Sk2) ...
                - 0.5.*log(2.*pi.*Vk2) - Uk.^2./(2.*Vk2);
            logProb(k) = log(count)-log(N-1+alpha)+logLike;
        end
        logProb(K+1) = log(alpha)-log(N-1+alpha) ...
            -0.5.*log(2.*pi.*(sigmaX2+A2))-xn.^2./(2.*(sigmaX2+A2));
        Gumbel = zeros(1,N+1);
        for j = 1:(K+1)
            Gumbel(j) = -log(-log(rand));
        end
        [~,index] = max(Gumbel(1:(K+1))+logProb(1:(K+1)));
        index = gather(index);
        if index == K+1
            K = K+1;
        end
        Table(n) = index;
        counts(index) = counts(index)+1;
        sums(index) = sums(index)+xn;
    end
    AA = 0.001;
    BB = 0.001;
    % Beta(a,b) = G_a/(G_a+G_b), independent unit-scale Gamma draws.
    ga = gamrnd(alpha+1,1);
    gb = gamrnd(N,1);
    phiE = ga./(ga+gb);
    piE1 = alpha+K-1;
    piE2 = N.*(BB-log(phiE));
    piE = piE1./(piE1+piE2);
    U = rand;
    if U < gather(piE)
        shape = AA+K;
    else
        shape = AA+K-1;
    end
    rate = BB-log(phiE);
    alpha = gather(gamrnd(shape,1./rate));
    AlphaS(iter) = alpha;
    ClusterS(iter) = K;
    fprintf('MARGINAL_PROGRESS:%d\n',iter);
end
Means = zeros(1,N);
for k = 1:K
    M = A2.*sums(k)./(sigmaX2+A2.*counts(k));
    S2 = A2.*sigmaX2./(sigmaX2+A2.*counts(k));
    Means(k) = normrnd(M,sqrt(S2));
end
XMeans = zeros(1,N);
for n = 1:N
    XMeans(n) = Means(Table(n));
end
% Solve the original monotone expected-cluster equation by bisection.
lo = 0;
hi = 1;
while gather(sum(hi./(hi+(0:(N-1))))) < 3
    hi = hi.*2;
end
for j = 1:80
    mid = (lo+hi)./2;
    if gather(sum(mid./(mid+(0:(N-1))))) < 3
        lo = mid;
    else
        hi = mid;
    end
end
hyperp = (lo+hi)./2;
result = struct('N',N,'ChainLength',ChainLength,'sigmaX2',sigmaX2,'A2',A2, ...
    'X',X,'Table',Table,'AlphaS',AlphaS(1:ChainLength),'ClusterS',ClusterS(1:ChainLength),'Means',Means(1:K), ...
    'counts',counts(1:K),'XMeans',XMeans,'K',K,'hyperp',hyperp,'alpha',alpha);
end
