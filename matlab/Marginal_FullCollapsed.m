%% Data simulation
N = 600;
X = zeros(1,N);
truemean = [-5,0,5];
for n = 1:N
    index = find(mnrnd(1,[1/3,1/3,1/3]));
    X(n) = normrnd(truemean(index),1);
end
X = sort(X);
truepdf = @(x) (1/3)*normpdf(x,-5,1) ...
    + (1/3)*normpdf(x,0,1) + (1/3)*normpdf(x,5,1);

%% MCMC initial settings
alpha = 1;

ChainLength = 1000;

AlphaS = zeros(1,ChainLength);

Table = zeros(1,N);

sigmaX2 = 1;
A2 = 30;

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
    phiE = betarnd(alpha+1,N);
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

    disp(['Iteration: ' num2str(iter) '. '])
end
disp('FullCollapsed')

%% Update Mean Values
Means = zeros(1,KN);
for k = 1:KN
    nk = length(find(Table == k));
    sumX = sum(X(find(Table == k)));
    M = A2 * sumX / (sigmaX2 + A2*nk);
    S2 = A2 * sigmaX2 / (sigmaX2 + A2*nk);
    Means(k) = normrnd(M,sqrt(S2));
    disp(['Mean = ' num2str(Means(k)) ' Count = ' num2str(nk)])
end
XMeans = zeros(1,N);
for n = 1:N
    XMeans(n) = Means(Table(n));
end

%% Compare hyperparameters
fun1 = @(xalpha) sum(1./(1+ (((1:N)-1)/xalpha) )) - 3;
hyperp = fzero(fun1,0.5);
figure
plot(AlphaS)
hold on 
plot(1:ChainLength,hyperp*ones(1,ChainLength),'k')