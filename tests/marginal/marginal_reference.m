function result = marginal_reference(N,ChainLength,alpha,sigmaX2,A2)
% Test reference: original full scans; only categorical/Beta sampling expanded.
%% Data simulation

X = zeros(1,N);
truemean = [-5,0,5];
for n = 1:N
    index = min(3, floor(3*rand)+1);
    X(n) = normrnd(truemean(index),1);
end
X = sort(X);
truepdf = @(x) (1/3)*normpdf(x,-5,1) ...
    + (1/3)*normpdf(x,0,1) + (1/3)*normpdf(x,5,1);

%% MCMC initial settings




AlphaS = zeros(1,ChainLength);
ClusterS = zeros(1,ChainLength);

Table = zeros(1,N);




%% Update Tables
for iter = 1:ChainLength
    for n = 1:N
        Table(n) = 0;
        TableIndex = unique(nonzeros(Table));
        KN = length(TableIndex);
        
        logLike = zeros(1,KN+1);
        nk = zeros(1,KN);
        for k = 1:KN
            count = 0;
            sumX = 0;
            for ii = 1:N
                if Table(ii) == TableIndex(k)
                    count = count + 1;
                    sumX = sumX + X(ii);
                else
                end
            end
            nk(k) = count;
            Mk = A2 * (X(n) + sumX) / ((count+1)*A2 + sigmaX2);
            Sk2 = sigmaX2 * A2 / ((count+1)*A2 + sigmaX2);
            Uk = A2 * sumX / (count*A2 + sigmaX2);
            Vk2 = sigmaX2 * A2 / (count*A2 + sigmaX2);
            logLike(k) = - (1/2)*log(2*pi*sigmaX2) - ((X(n)^2)/(2*sigmaX2)) ...
                + (1/2)*log(2*pi*Sk2) + ((Mk^2)/(2*Sk2)) ...
                - (1/2)*log(2*pi*Vk2) - ((Uk^2)/(2*Vk2));
        end

        logLike(KN+1) = -(1/2)*log(2*pi*(sigmaX2 + A2)) ...
            - ((X(n)^2) / (2*(sigmaX2 + A2)));
        
        logProb = zeros(1,KN+1);
        for k = 1:KN
            logProb(k) = log(nk(k)) - log(N-1+alpha) + logLike(k);
        end
        logProb(KN+1) = log(alpha) - log(N-1+alpha) + logLike(KN+1);
        Gumbel = zeros(1,KN+1);
        for j = 1:(KN+1)
            Gumbel(j) = -log(-log(rand));
        end
        GumbelUMaxVector = Gumbel + logProb;
        [~,index] = max(GumbelUMaxVector);
        if index == (KN+1)
            Table(n) = 9999;
        else
            Table(n) = TableIndex(index);
        end
        
        KN = length(unique(nonzeros(Table)));
        TableIndex = unique(nonzeros(Table));
        TableLeft = zeros(1,N);
        for ii = 1:N
            for k = 1:KN
                if Table(ii) == TableIndex(k)
                    TableLeft(ii) = k;
                else
                end
            end
        end
        Table = TableLeft;
    end

    KN = length(unique(nonzeros(Table)));
    AA = 0.001;
    BB = 0.001;
    ga = gamrnd(alpha+1,1); gb = gamrnd(N,1); phiE = ga/(ga+gb);
    piE1 = alpha + KN - 1;
    piE2 = N * (BB - log(phiE));
    piE = piE1 / (piE1 + piE2);
    U = rand;
    if U < piE
        shape = AA + KN;
        rate = BB - log(phiE);
        alpha = gamrnd(shape,1/rate);
    else
        shape = AA + KN - 1;
        rate = BB - log(phiE);
        alpha = gamrnd(shape,1/rate);
    end
    AlphaS(iter) = alpha;
ClusterS(iter) = KN;

end

%% Update Mean Values
Means = zeros(1,KN);
for k = 1:KN
    nk = length(find(Table == k));
    sumX = sum(X(find(Table == k)));
    M = A2 * sumX / (sigmaX2 + A2*nk);
    S2 = A2 * sigmaX2 / (sigmaX2 + A2*nk);
    Means(k) = normrnd(M,sqrt(S2));
end
XMeans = zeros(1,N);
for n = 1:N
    XMeans(n) = Means(Table(n));
end

%% Compare hyperparameters
fun1 = @(xalpha) sum(1./(1+ (((1:N)-1)/xalpha) )) - 3;
% Bracket the positive root: the original scalar guess can cross negative poles for small N.
hyperp = fzero(fun1,[eps,N]);

counts = zeros(1,KN);
for k=1:KN; counts(k)=sum(Table==k); end
result = struct('N',N,'ChainLength',ChainLength,'sigmaX2',sigmaX2,'A2',A2,'X',X,'Table',Table,'AlphaS',AlphaS,'ClusterS',ClusterS,'Means',Means,'counts',counts,'XMeans',XMeans,'K',KN,'hyperp',hyperp,'alpha',alpha);
end
