function simulation = simulate_heat_diffusion_demo( ...
        initialTemperature, ambient, ratio, numSteps, snapshotSteps)
%SIMULATE_HEAT_DIFFUSION_DEMO 使用显式有限差分更新二维温度。

    if ratio <= 0 || ratio > 0.25
        error('Demo:UnstableHeatRatio', ...
            'The explicit two-dimensional scheme requires 0 < ratio <= 0.25.');
    end
    if any(snapshotSteps < 0) || any(snapshotSteps > numSteps) || ...
            any(snapshotSteps ~= floor(snapshotSteps))
        error('Demo:InvalidSnapshotStep', 'Snapshot steps are outside the simulation.');
    end

    temperature = initialTemperature;
    peak = zeros(numSteps + 1, 1);
    meanTemperature = zeros(numSteps + 1, 1);
    energy = zeros(numSteps + 1, 1);
    snapshots = zeros([size(temperature), numel(snapshotSteps)]);
    peak(1) = max(temperature(:));
    meanTemperature(1) = mean(temperature(:));
    excess = temperature(:) - ambient;
    excess(excess < 0) = 0;
    energy(1) = sum(excess);
    snapshotIndex = find(snapshotSteps == 0, 1);
    if ~isempty(snapshotIndex)
        snapshots(:, :, snapshotIndex) = temperature;
    end

    for step = 1:numSteps
        updated = temperature;
        updated(2:end - 1, 2:end - 1) = temperature(2:end - 1, 2:end - 1) + ...
            ratio * ( ...
            temperature(1:end - 2, 2:end - 1) + ...
            temperature(3:end, 2:end - 1) + ...
            temperature(2:end - 1, 1:end - 2) + ...
            temperature(2:end - 1, 3:end) - ...
            4 * temperature(2:end - 1, 2:end - 1));
        % 避免运行器对索引向量内 end 的兼容问题。
        updated([1, size(updated, 1)], :) = ambient;
        updated(:, [1, size(updated, 2)]) = ambient;
        temperature = updated;

        peak(step + 1) = max(temperature(:));
        meanTemperature(step + 1) = mean(temperature(:));
        excess = temperature(:) - ambient;
        excess(excess < 0) = 0;
        energy(step + 1) = sum(excess);
        snapshotIndex = find(snapshotSteps == step, 1);
        if ~isempty(snapshotIndex)
            snapshots(:, :, snapshotIndex) = temperature;
        end
    end

    simulation = struct( ...
        'initialTemperature', initialTemperature, ...
        'finalTemperature', temperature, ...
        'ratio', ratio, ...
        'steps', (0:numSteps)', ...
        'peak', peak, ...
        'meanTemperature', meanTemperature, ...
        'energy', energy, ...
        'snapshotSteps', snapshotSteps, ...
        'snapshots', snapshots);
end
