/* script.js */

document.getElementById('calculateButton').addEventListener('click', calculateGrid);
document.getElementById('resetButton').addEventListener('click', resetForm);
document.getElementById('downloadImage').addEventListener('click', downloadCanvasImage);

function calculateGrid() {
    // Retrieve input values
    const roomLength = parseFloat(document.getElementById('roomLength').value);
    const roomWidth = parseFloat(document.getElementById('roomWidth').value);
    const tileSize = document.getElementById('tileSize').value;
    const frameRotation = parseFloat(document.getElementById('frameRotation').value);

    // Validate inputs
    if (!validateInputs(roomLength, roomWidth)) {
        return;
    }

    // Process tile size
    let [tileWidth, tileLength] = tileSize.split('x').map(Number);

    // Ensure tile dimensions are correctly assigned
    if (tileWidth > tileLength) {
        [tileWidth, tileLength] = [tileLength, tileWidth];
    }

    // Perform calculations
    const totalArea = (roomLength * roomWidth) / 1e6; // Convert mm² to m²
    const totalPerimeter = 2 * (roomLength + roomWidth) / 1000; // Convert mm to m

    // Update summary section
    document.getElementById('totalArea').textContent = totalArea.toFixed(2);
    document.getElementById('totalPerimeter').textContent = totalPerimeter.toFixed(2);
    document.getElementById('roomDimensions').textContent = `${roomLength} x ${roomWidth}`;

    // Calculate grid layout
    const gridData = calculateGridLayout(roomLength, roomWidth, tileWidth, tileLength);

    if (!gridData) {
        // An error occurred during grid calculation
        return;
    }

    // Update material breakdown
    updateMaterialBreakdown(gridData);

    // Draw grid
    drawGrid(gridData, frameRotation);
}

function validateInputs(roomLength, roomWidth) {
    let isValid = true;

    if (isNaN(roomLength) || roomLength <= 0) {
        alert('Please enter a valid Room Length.');
        isValid = false;
    }
    if (isNaN(roomWidth) || roomWidth <= 0) {
        alert('Please enter a valid Room Width.');
        isValid = false;
    }

    return isValid;
}

function calculateGridLayout(roomLength, roomWidth, tileWidth, tileLength) {
    // Minimum and Maximum leftover size on each side
    const MIN_LEFTOVER = 301; // mm
    const MAX_LEFTOVER = 600; // mm

    // Calculate the number of full tiles along each axis ensuring leftovers >= MIN_LEFTOVER
    let numFullTilesX = Math.floor((roomWidth - 2 * MIN_LEFTOVER) / tileWidth);
    let leftoverX = roomWidth - numFullTilesX * tileWidth;
    let leftoverPerSideX = leftoverX / 2;

    let numFullTilesY = Math.floor((roomLength - 2 * MIN_LEFTOVER) / tileLength);
    let leftoverY = roomLength - numFullTilesY * tileLength;
    let leftoverPerSideY = leftoverY / 2;

    // If leftover per side is less than MIN_LEFTOVER, reduce the number of full tiles by one
    if (leftoverPerSideX < MIN_LEFTOVER) {
        if (numFullTilesX > 0) {
            numFullTilesX -= 1;
            leftoverX = roomWidth - numFullTilesX * tileWidth;
            leftoverPerSideX = leftoverX / 2;
        }
    }

    if (leftoverPerSideY < MIN_LEFTOVER) {
        if (numFullTilesY > 0) {
            numFullTilesY -= 1;
            leftoverY = roomLength - numFullTilesY * tileLength;
            leftoverPerSideY = leftoverY / 2;
        }
    }

    // Recalculate leftovers after potential reduction
    const adjustedLeftoverX = roomWidth - numFullTilesX * tileWidth;
    const adjustedLeftoverPerSideX = adjustedLeftoverX / 2;

    const adjustedLeftoverY = roomLength - numFullTilesY * tileLength;
    const adjustedLeftoverPerSideY = adjustedLeftoverY / 2;

    // Ensure that the adjusted leftovers are within the allowed range
    if ((adjustedLeftoverPerSideX < MIN_LEFTOVER && adjustedLeftoverPerSideX !== 0) ||
        (adjustedLeftoverPerSideY < MIN_LEFTOVER && adjustedLeftoverPerSideY !== 0)) {
        alert('Unable to fit tiles with the given constraints. Please adjust room dimensions or tile size.');
        return null;
    }

    if ((adjustedLeftoverPerSideX > MAX_LEFTOVER && adjustedLeftoverPerSideX !== 0) ||
        (adjustedLeftoverPerSideY > MAX_LEFTOVER && adjustedLeftoverPerSideY !== 0)) {
        alert(`The leftover space on each side should not exceed ${MAX_LEFTOVER}mm. Please adjust room dimensions or tile size.`);
        return null;
    }

    // Generate grid lines for tiles
    const tileGridX = generateTileGridLines(roomWidth, tileWidth, adjustedLeftoverPerSideX);
    const tileGridY = generateTileGridLines(roomLength, tileLength, adjustedLeftoverPerSideY);

    // Main runners positioning
    const mainRunnerPositions = calculateMainRunners(roomWidth, adjustedLeftoverPerSideX);

    // Cross tees based on configuration
    let crossTeesData;
    if (tileWidth === 600 && tileLength === 600) {
        // 600x600 configuration
        crossTeesData = calculateCrossTees600x600(tileGridX, tileGridY);
    } else if (tileWidth === 600 && tileLength === 1200) {
        // 600x1200 configuration
        crossTeesData = calculateCrossTees600x1200(tileGridX, tileGridY);
    } else {
        alert('Unsupported tile size configuration.');
        return null;
    }

    // Suspension wires positions (along main runners every 1200mm starting within leftover per side)
    const suspensionWirePositions = calculateSuspensionWires(roomLength, mainRunnerPositions, adjustedLeftoverPerSideY);

    return {
        roomLength,
        roomWidth,
        tileWidth,
        tileLength,
        numFullTilesX,
        numFullTilesY,
        perimeterCutX: adjustedLeftoverPerSideX,
        perimeterCutY: adjustedLeftoverPerSideY,
        tileGridX,
        tileGridY,
        mainRunnerPositions,
        crossTeesData,
        suspensionWirePositions
    };
}

function generateTileGridLines(roomDimension, tileDimension, leftoverPerSide) {
    const gridLines = [0];
    let currentPosition = leftoverPerSide;

    while (currentPosition <= roomDimension - leftoverPerSide) {
        gridLines.push(currentPosition);
        currentPosition += tileDimension;
    }

    // Adjust for exact fits or rounding errors
    if (gridLines[gridLines.length - 1] !== roomDimension - leftoverPerSide) {
        gridLines.push(roomDimension - leftoverPerSide);
    }

    gridLines.push(roomDimension);
    return gridLines;
}

function calculateMainRunners(roomWidth, leftoverPerSideX) {
    const MAIN_RUNNER_SPACING = 1200; // mm
    const MIN_END_DISTANCE = 600; // mm

    const mainRunnerPositions = [];
    let currentPosition = leftoverPerSideX; // Start at leftover per side

    // Add main runners at every 1200mm until we reach or exceed roomWidth - leftoverPerSideX
    while (currentPosition < roomWidth - leftoverPerSideX) {
        mainRunnerPositions.push(currentPosition);
        currentPosition += MAIN_RUNNER_SPACING;
    }

    // Check if we need to add an extra main runner at the end
    const lastRunnerPosition = mainRunnerPositions[mainRunnerPositions.length - 1];
    const remainingDistance = roomWidth - lastRunnerPosition;

    if (remainingDistance > MIN_END_DISTANCE) {
        // Add an extra main runner at roomWidth - leftoverPerSideX
        mainRunnerPositions.push(roomWidth - leftoverPerSideX);
    }

    return mainRunnerPositions;
}

function calculateCrossTees600x600(tileGridX, tileGridY) {
    const longCrossTees = [];
    const shortCrossTees = [];

    // Long cross tees (1200mm) aligned with Y-axis (horizontal lines)
    for (let yIndex = 1; yIndex < tileGridY.length - 1; yIndex++) {
        const y = tileGridY[yIndex];
        if (y === 0 || y === tileGridY[tileGridY.length - 1]) continue; // Skip perimeter
        for (let i = 0; i < tileGridX.length - 1; i++) {
            longCrossTees.push({ xStart: tileGridX[i], xEnd: tileGridX[i + 1], y });
        }
    }

    // Short cross tees (600mm) aligned with X-axis (vertical lines)
    for (let xIndex = 1; xIndex < tileGridX.length - 1; xIndex++) {
        const x = tileGridX[xIndex];
        if (x === 0 || x === tileGridX[tileGridX.length - 1]) continue; // Skip perimeter
        for (let i = 0; i < tileGridY.length - 1; i++) {
            shortCrossTees.push({ x, yStart: tileGridY[i], yEnd: tileGridY[i + 1] });
        }
    }

    return { longCrossTees, shortCrossTees };
}

function calculateCrossTees600x1200(tileGridX, tileGridY) {
    const longCrossTees = [];

    // Long cross tees (1200mm) aligned with Y-axis (horizontal lines)
    for (let yIndex = 1; yIndex < tileGridY.length - 1; yIndex++) {
        const y = tileGridY[yIndex];
        if (y === 0 || y === tileGridY[tileGridY.length - 1]) continue; // Skip perimeter
        for (let i = 0; i < tileGridX.length - 1; i++) {
            longCrossTees.push({ xStart: tileGridX[i], xEnd: tileGridX[i + 1], y });
        }
    }

    return { longCrossTees };
}

function calculateSuspensionWires(roomLength, mainRunnerPositions, leftoverPerSideY) {
    const SUSPENSION_SPACING = 1200; // mm

    const suspensionWires = [];

    mainRunnerPositions.forEach(x => {
        let y = leftoverPerSideY;
        while (y <= roomLength - leftoverPerSideY) {
            suspensionWires.push({ x, y });
            y += SUSPENSION_SPACING;
        }
    });

    return suspensionWires;
}

function updateMaterialBreakdown(gridData) {
    // Tiles count (including perimeter tiles)
    const tilesCount = (gridData.numFullTilesX + 2) * (gridData.numFullTilesY + 2);

    // Main runners count (standard length 3.6m)
    const mainRunnersLength = gridData.mainRunnerPositions.length * gridData.roomLength; // Total length in mm
    const mainRunnerStandardLength = 3600; // mm
    const mainRunnersCount = Math.ceil(mainRunnersLength / mainRunnerStandardLength);

    // Cross tees count
    let longCrossTeesCount = 0;
    let shortCrossTeesCount = 0;

    if (gridData.crossTeesData.longCrossTees) {
        longCrossTeesCount = gridData.crossTeesData.longCrossTees.length;
    }
    if (gridData.crossTeesData.shortCrossTees) {
        shortCrossTeesCount = gridData.crossTeesData.shortCrossTees.length;
    }

    // Suspension wires count
    const suspensionWiresCount = gridData.suspensionWirePositions.length;

    // Perimeter trims count (standard length 3m)
    const perimeterLength = 2 * (gridData.roomLength + gridData.roomWidth);
    const perimeterTrimStandardLength = 3000; // mm
    const perimeterTrimsCount = Math.ceil(perimeterLength / perimeterTrimStandardLength);

    // Update material counts in the DOM
    document.getElementById('tilesCount').textContent = tilesCount;
    document.getElementById('mainRunnersCount').textContent = mainRunnersCount;
    document.getElementById('longCrossTeesCount').textContent = longCrossTeesCount;
    document.getElementById('shortCrossTeesCount').textContent = shortCrossTeesCount;
    document.getElementById('suspensionWiresCount').textContent = suspensionWiresCount;
    document.getElementById('perimeterTrimsCount').textContent = perimeterTrimsCount;
}

function drawGrid(gridData, frameRotation) {
    const canvas = document.getElementById('ceilingCanvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale factor
    const scaleFactor = calculateScaleFactor(gridData.roomWidth, gridData.roomLength, canvas.width, canvas.height);

    // Center the grid in the canvas
    const offsetX = (canvas.width - gridData.roomWidth * scaleFactor) / 2;
    const offsetY = (canvas.height - gridData.roomLength * scaleFactor) / 2;

    // Apply transformations
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((frameRotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleFactor, scaleFactor);

    // Draw grid elements based on user preferences
    if (document.getElementById('showTiles').checked) {
        drawTiles(ctx, gridData);
    }

    if (document.getElementById('showMainRunners').checked) {
        drawMainRunners(ctx, gridData);
    }

    if (document.getElementById('showCrossTees').checked) {
        drawCrossTees(ctx, gridData);
    }

    drawPerimeter(ctx, gridData); // Draw perimeter after other elements

    if (document.getElementById('showSuspensionWires').checked) {
        drawSuspensionWires(ctx, gridData);
    }

    if (document.getElementById('showDimensions').checked) {
        drawDimensions(ctx, gridData);
        drawPerimeterCutDimensions(ctx, gridData);
    }

    // Draw watermark
    drawWatermark(ctx);

    ctx.restore();
}

function calculateScaleFactor(roomWidth, roomLength, canvasWidth, canvasHeight) {
    const padding = 100; // pixels
    const scaleX = (canvasWidth - padding * 2) / roomWidth;
    const scaleY = (canvasHeight - padding * 2) / roomLength;
    return Math.min(scaleX, scaleY);
}

function drawPerimeter(ctx, gridData) {
    ctx.strokeStyle = '#95a5a6'; // Perimeter color
    ctx.lineWidth = 3 / ctx.getTransform().a; // Adjust line width based on scale

    ctx.strokeRect(0, 0, gridData.roomWidth, gridData.roomLength);
}

function drawTiles(ctx, gridData) {
    ctx.fillStyle = '#bdc3c7'; // Tile color
    ctx.strokeStyle = '#7f8c8d'; // Tile border color
    ctx.lineWidth = 1 / ctx.getTransform().a; // Adjust line width based on scale

    for (let i = 0; i < gridData.tileGridX.length - 1; i++) {
        for (let j = 0; j < gridData.tileGridY.length - 1; j++) {
            const x = gridData.tileGridX[i];
            const y = gridData.tileGridY[j];
            const width = gridData.tileGridX[i + 1] - x;
            const height = gridData.tileGridY[j + 1] - y;

            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
        }
    }
}

function drawMainRunners(ctx, gridData) {
    ctx.strokeStyle = '#e74c3c'; // Main runners color
    ctx.lineWidth = 5 / ctx.getTransform().a; // Adjust line width based on scale

    gridData.mainRunnerPositions.forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gridData.roomLength);
        ctx.stroke();
    });
}

function drawCrossTees(ctx, gridData) {
    // Long Cross Tees (1200mm)
    if (gridData.crossTeesData.longCrossTees) {
        ctx.strokeStyle = '#2ecc71'; // Long cross tees color
        ctx.lineWidth = 3 / ctx.getTransform().a;

        gridData.crossTeesData.longCrossTees.forEach(ct => {
            ctx.beginPath();
            ctx.moveTo(ct.xStart, ct.y);
            ctx.lineTo(ct.xEnd, ct.y);
            ctx.stroke();
        });
    }

    // Short Cross Tees (600mm)
    if (gridData.crossTeesData.shortCrossTees) {
        ctx.strokeStyle = '#3498db'; // Short cross tees color
        ctx.lineWidth = 2 / ctx.getTransform().a;

        gridData.crossTeesData.shortCrossTees.forEach(ct => {
            ctx.beginPath();
            ctx.moveTo(ct.x, ct.yStart);
            ctx.lineTo(ct.x, ct.yEnd);
            ctx.stroke();
        });
    }
}

function drawSuspensionWires(ctx, gridData) {
    ctx.fillStyle = '#f1c40f'; // Suspension wires color
    const radius = 5 / ctx.getTransform().a;

    gridData.suspensionWirePositions.forEach(pos => {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawDimensions(ctx, gridData) {
    ctx.strokeStyle = '#333333'; // Dimensions color
    ctx.lineWidth = 1 / ctx.getTransform().a;
    ctx.font = `${20 / ctx.getTransform().a}px Arial`;
    ctx.fillStyle = '#333333';

    // Horizontal dimension (Room Width)
    ctx.beginPath();
    ctx.moveTo(0, gridData.roomLength + 50 / ctx.getTransform().a);
    ctx.lineTo(gridData.roomWidth, gridData.roomLength + 50 / ctx.getTransform().a);
    ctx.stroke();
    ctx.fillText(`${gridData.roomWidth} mm`, gridData.roomWidth / 2, gridData.roomLength + 70 / ctx.getTransform().a);

    // Vertical dimension (Room Length)
    ctx.beginPath();
    ctx.moveTo(gridData.roomWidth + 50 / ctx.getTransform().a, 0);
    ctx.lineTo(gridData.roomWidth + 50 / ctx.getTransform().a, gridData.roomLength);
    ctx.stroke();
    ctx.save();
    ctx.translate(gridData.roomWidth + 70 / ctx.getTransform().a, gridData.roomLength / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${gridData.roomLength} mm`, 0, 0);
    ctx.restore();
}

function drawPerimeterCutDimensions(ctx, gridData) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1 / ctx.getTransform().a;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent for clarity
    ctx.font = `${16 / ctx.getTransform().a}px Arial`;
    ctx.textAlign = 'center';

    // Left Perimeter Cut Width
    if (gridData.perimeterCutX > 0) {
        ctx.beginPath();
        ctx.moveTo(gridData.perimeterCutX, 0);
        ctx.lineTo(gridData.perimeterCutX, -30 / ctx.getTransform().a);
        ctx.stroke();
        ctx.fillText(`${gridData.perimeterCutX.toFixed(0)} mm`, gridData.perimeterCutX / 2, -15 / ctx.getTransform().a);
    }

    // Right Perimeter Cut Width
    if (gridData.perimeterCutX > 0) {
        ctx.beginPath();
        ctx.moveTo(gridData.roomWidth - gridData.perimeterCutX, 0);
        ctx.lineTo(gridData.roomWidth - gridData.perimeterCutX, -30 / ctx.getTransform().a);
        ctx.stroke();
        ctx.fillText(`${gridData.perimeterCutX.toFixed(0)} mm`, gridData.roomWidth - gridData.perimeterCutX / 2, -15 / ctx.getTransform().a);
    }

    // Top Perimeter Cut Length
    if (gridData.perimeterCutY > 0) {
        ctx.beginPath();
        ctx.moveTo(0, gridData.perimeterCutY);
        ctx.lineTo(-30 / ctx.getTransform().a, gridData.perimeterCutY);
        ctx.stroke();
        ctx.save();
        ctx.translate(-35 / ctx.getTransform().a, gridData.perimeterCutY / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${gridData.perimeterCutY.toFixed(0)} mm`, 0, 0);
        ctx.restore();
    }

    // Bottom Perimeter Cut Length
    if (gridData.perimeterCutY > 0) {
        ctx.beginPath();
        ctx.moveTo(0, gridData.roomLength - gridData.perimeterCutY);
        ctx.lineTo(-30 / ctx.getTransform().a, gridData.roomLength - gridData.perimeterCutY);
        ctx.stroke();
        ctx.save();
        ctx.translate(-35 / ctx.getTransform().a, (gridData.roomLength - gridData.perimeterCutY / 2));
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${gridData.perimeterCutY.toFixed(0)} mm`, 0, 0);
        ctx.restore();
    }
}

function drawWatermark(ctx) {
    // Save current state
    ctx.save();

    // Reset transformations to draw the watermark in canvas space
    ctx.resetTransform();

    // Set font and styles
    const fontSize = 24; // Adjust as needed
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Calculate position at the center of the canvas
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;

    // Draw the watermark text (three lines)
    ctx.fillText('Griestu Meistars', centerX, centerY - fontSize);
    ctx.fillText('griestumeistars.lv', centerX, centerY);
    ctx.fillText('+37129285427', centerX, centerY + fontSize);

    // Restore the state
    ctx.restore();
}

function downloadCanvasImage() {
    const canvas = document.getElementById('ceilingCanvas');
    const link = document.createElement('a');
    link.download = 'ceiling-grid.png';
    link.href = canvas.toDataURL();
    link.click();
}

function resetForm() {
    // Clear all input fields and reset outputs
    document.getElementById('input-form').reset();

    // Reset summary and material breakdown
    document.getElementById('totalArea').textContent = '0';
    document.getElementById('totalPerimeter').textContent = '0';
    document.getElementById('roomDimensions').textContent = '0 x 0';
    document.getElementById('perimeterCutWidth').textContent = '0';
    document.getElementById('perimeterCutLength').textContent = '0';

    document.getElementById('tilesCount').textContent = '0';
    document.getElementById('mainRunnersCount').textContent = '0';
    document.getElementById('longCrossTeesCount').textContent = '0';
    document.getElementById('shortCrossTeesCount').textContent = '0';
    document.getElementById('suspensionWiresCount').textContent = '0';
    document.getElementById('perimeterTrimsCount').textContent = '0';

    // Clear canvas
    const canvas = document.getElementById('ceilingCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}