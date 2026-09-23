function [temperature, xGrid, yGrid, ambient] = initial_temperature_demo(gridSize)
%INITIAL_TEMPERATURE_DEMO 创建两个平滑热点及固定冷边界。

    if gridSize < 11
        error('Demo:InvalidHeatGrid', 'Grid size must be at least 11.');
    end
    ambient = 20;
    axisValues = linspace(-1, 1, gridSize);
    [xGrid, yGrid] = meshgrid(axisValues, axisValues);
    primary = 78 * exp(-((xGrid + 0.24) .^ 2 + ...
        (yGrid - 0.12) .^ 2) / 0.055);
    secondary = 42 * exp(-((xGrid - 0.38) .^ 2 + ...
        (yGrid + 0.31) .^ 2) / 0.030);
    temperature = ambient + primary + secondary;
    % 显式边界索引兼容浏览器运行器，数值含义不变。
    temperature([1, gridSize], :) = ambient;
    temperature(:, [1, gridSize]) = ambient;
end
