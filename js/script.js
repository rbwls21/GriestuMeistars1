/* script.js */

document.getElementById('calculateButton').addEventListener('click', calculateGrid);
document.getElementById('resetButton').addEventListener('click', resetForm);
document.getElementById('downloadImage').addEventListener('click', downloadCanvasImage);

function calculateGrid() {
    // Retrieve input values
    const roomLength = parseFloat(document.getElementById('roomLength').value);
    const roomWidth = parseFloat(document.getElementById('roomWidth').value);

    // Validate inputs
    if (!validateInputs(roomLength, roomWidth)) {
        return;
    }

    // Fixed tile size
    const tileWidth = 600; // mm
    const tileLength = 600; // mm

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
    drawGrid(gridData);
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
    const adjustedLeftoverX = leftoverPerSideX;
    const adjustedLeftoverY = leftoverPerSideY;

    // Ensure that the adjusted leftovers are within the allowed range
    if ((adjustedLeftoverX < MIN_LEFTOVER && adjustedLeftoverX !== 0) ||
        (adjustedLeftoverY < MIN_LEFTOVER && adjustedLeftoverY !== 0)) {
        alert('Unable to fit tiles with the given constraints. Please adjust room dimensions.');
        return null;
    }

    if ((adjustedLeftoverX > MAX_LEFTOVER && adjustedLeftoverX !== 0) ||
        (adjustedLeftoverY > MAX_LEFTOVER && adjustedLeftoverY !== 0)) {
        alert(`The leftover space on each side should not exceed ${MAX_LEFTOVER}mm. Please adjust room dimensions.`);
        return null;
    }

    // Generate grid lines for tiles
    const tileGridX = generateTileGridLines(roomWidth, tileWidth, adjustedLeftoverX);
    const tileGridY = generateTileGridLines(roomLength, tileLength, adjustedLeftoverY);

    // Main runners positioning
    const mainRunnerPositions = calculateMainRunners(roomWidth, adjustedLeftoverX);

    // Cross tees positioning
    const crossTeesData = calculateCrossTees(tileGridX, tileGridY, mainRunnerPositions, adjustedLeftoverX, adjustedLeftoverY, roomWidth, roomLength);

    // Suspension wires positions (along main runners every 1200mm starting within leftover per side)
    const suspensionWirePositions = calculateSuspensionWires(roomLength, mainRunnerPositions, adjustedLeftoverY);

    return {
        roomLength,
        roomWidth,
        tileWidth,
        tileLength,
        numFullTilesX,
        numFullTilesY,
        perimeterCutX: adjustedLeftoverX,
        perimeterCutY: adjustedLeftoverY,
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

    // Adding a small epsilon to account for floating-point precision
    const EPSILON = 1e-6;

    while (currentPosition <= roomDimension - leftoverPerSide + EPSILON) {
        gridLines.push(currentPosition);
        currentPosition += tileDimension;
    }

    // Ensure that the last internal grid line is included
    if (Math.abs(gridLines[gridLines.length - 1] - (roomDimension - leftoverPerSide)) > EPSILON) {
        gridLines.push(roomDimension - leftoverPerSide);
    }

    gridLines.push(roomDimension);
    return gridLines;
}

function calculateMainRunners(roomWidth, leftoverPerSideX) {
    const MAIN_RUNNER_SPACING = 1200; // mm

    const mainRunnerPositions = [];
    let currentPosition = leftoverPerSideX;

    // Place main runners every 1200mm starting from the left
    while (currentPosition < roomWidth - leftoverPerSideX + 1e-6) {
        mainRunnerPositions.push(currentPosition);
        currentPosition += MAIN_RUNNER_SPACING;
    }

    // Ensure last main runner is added if not already
    if (roomWidth - leftoverPerSideX - mainRunnerPositions[mainRunnerPositions.length - 1] > 1e-6) {
        mainRunnerPositions.push(roomWidth - leftoverPerSideX);
    }

    return mainRunnerPositions;
}

function calculateCrossTees(tileGridX, tileGridY, mainRunnerPositions, adjustedLeftoverX, adjustedLeftoverY, roomWidth, roomLength) {
    const longCrossTees = [];
    const shortCrossTees = [];

    // For each tile line in Y direction (excluding perimeter)
    for (let yIndex = 1; yIndex < tileGridY.length - 1; yIndex++) {
        const y = tileGridY[yIndex];

        // Place cross tees between main runners (excluding perimeter)
        for (let i = 0; i < mainRunnerPositions.length - 1; i++) {
            const xStart = mainRunnerPositions[i];
            const xEnd = mainRunnerPositions[i + 1];
            const distance = xEnd - xStart;

            if (Math.abs(distance - 1200) < 1e-6) {
                // Use long cross tee
                longCrossTees.push({ xStart, xEnd, y });
            } else if (Math.abs(distance - 600) < 1e-6 || distance < 600) {
                // Use short cross tee
                shortCrossTees.push({
                    xStart,
                    xEnd,
                    y,
                    orientation: 'horizontal',
                    atPerimeter: false
                });
            } else {
                // For other distances, handle accordingly (e.g., use multiple tees)
                // This could be expanded to handle different sizes if necessary
            }
        }

        // At the left perimeter cut
        if (adjustedLeftoverX > 0 && adjustedLeftoverX <= 600) {
            shortCrossTees.push({
                xStart: 0,
                xEnd: adjustedLeftoverX,
                y,
                orientation: 'horizontal',
                atPerimeter: true
            });
        }

        // At the right perimeter cut
        if (adjustedLeftoverX > 0 && adjustedLeftoverX <= 600) {
            shortCrossTees.push({
                xStart: roomWidth - adjustedLeftoverX,
                xEnd: roomWidth,
                y,
                orientation: 'horizontal',
                atPerimeter: true
            });
        }
    }

    // Place short cross tees along X direction (excluding perimeter)
    for (let xIndex = 1; xIndex < tileGridX.length - 1; xIndex++) {
        const x = tileGridX[xIndex];

        // Skip if x coincides with a main runner position
        if (mainRunnerPositions.some(pos => Math.abs(pos - x) < 1e-6)) continue;

        // For each space between tile grid lines in Y direction (excluding perimeter)
        for (let yIndex = 1; yIndex < tileGridY.length - 1; yIndex++) {
            const yStart = tileGridY[yIndex];
            const yEnd = tileGridY[yIndex + 1];

            // Place short cross tees
            shortCrossTees.push({
                x,
                yStart,
                yEnd,
                orientation: 'vertical',
                atPerimeter: false
            });
        }

        // At the top perimeter cut
        if (adjustedLeftoverY > 0 && adjustedLeftoverY <= 600) {
            shortCrossTees.push({
                x,
                yStart: 0,
                yEnd: adjustedLeftoverY,
                orientation: 'vertical',
                atPerimeter: true,
                position: 'top'
            });
        }

        // At the bottom perimeter cut
        if (adjustedLeftoverY > 0 && adjustedLeftoverY <= 600) {
            shortCrossTees.push({
                x,
                yStart: roomLength - adjustedLeftoverY,
                yEnd: roomLength,
                orientation: 'vertical',
                atPerimeter: true,
                position: 'bottom'
            });
        }
    }

    return { longCrossTees, shortCrossTees };
}

function calculateSuspensionWires(roomLength, mainRunnerPositions, adjustedLeftoverY) {
    const SUSPENSION_SPACING = 1200; // mm

    const suspensionWires = [];

    mainRunnerPositions.forEach(x => {
        let y = adjustedLeftoverY;
        while (y <= roomLength - adjustedLeftoverY + 1e-6) {
            suspensionWires.push({ x, y });
            y += SUSPENSION_SPACING;
        }
    });

    return suspensionWires;
}

function updateMaterialBreakdown(gridData) {
    // Tiles count (including perimeter tiles)
    const tilesCount = (gridData.numFullTilesX + 2) * (gridData.numFullTilesY + 2);

    // Main runners
    const mainRunnerStandardLength = 3600; // mm
    const mainRunnerRows = gridData.mainRunnerPositions.length;
    const mainRunnersPerRow = Math.ceil(gridData.roomLength / mainRunnerStandardLength);
    const totalMainRunners = mainRunnerRows * mainRunnersPerRow;

    // Cross tees count
    const longCrossTeesCount = gridData.crossTeesData.longCrossTees.length;

    // Short cross tees count (exclude vertical tees at the bottom perimeter)
    const shortCrossTeesCount = gridData.crossTeesData.shortCrossTees.filter(ct => {
        return !(ct.orientation === 'vertical' && ct.atPerimeter && ct.position === 'bottom');
    }).length;

    // Suspension wires count
    const suspensionWiresCount = gridData.suspensionWirePositions.length;

    // Perimeter trims count (standard length 3m)
    const perimeterLength = 2 * (gridData.roomLength + gridData.roomWidth);
    const perimeterTrimStandardLength = 3000; // mm
    const perimeterTrimsCount = Math.ceil(perimeterLength / perimeterTrimStandardLength);

    // Update material counts in the DOM
    document.getElementById('tilesCount').textContent = tilesCount;
    document.getElementById('mainRunnersCount').textContent = totalMainRunners;
    document.getElementById('longCrossTeesCount').textContent = longCrossTeesCount;
    document.getElementById('shortCrossTeesCount').textContent = shortCrossTeesCount;
    document.getElementById('suspensionWiresCount').textContent = suspensionWiresCount;
    document.getElementById('perimeterTrimsCount').textContent = perimeterTrimsCount;

    // Update perimeter cuts in the DOM
    document.getElementById('perimeterCutWidth').textContent = gridData.perimeterCutX.toFixed(0);
    document.getElementById('perimeterCutLength').textContent = gridData.perimeterCutY.toFixed(0);
}

function drawGrid(gridData) {
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
            if (ct.yStart !== undefined && ct.yEnd !== undefined) {
                // Vertical short cross tee
                ctx.beginPath();
                ctx.moveTo(ct.x, ct.yStart);
                ctx.lineTo(ct.x, ct.yEnd);
                ctx.stroke();
            } else if (ct.xStart !== undefined && ct.xEnd !== undefined) {
                // Horizontal short cross tee
                ctx.beginPath();
                ctx.moveTo(ct.xStart, ct.y);
                ctx.lineTo(ct.xEnd, ct.y);
                ctx.stroke();
            }
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