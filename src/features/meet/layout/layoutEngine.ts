import { LayoutItem, LayoutParticipant, LayoutEngineParams } from './types';

/**
 * Priority sorting for layout elements:
 * 1. Screen Shares
 * 2. Active Speaker
 * 3. Pinned Users
 * 4. Hand Raised
 * 5. Camera Active
 * 6. Audio Only / Rest
 */
export function sortParticipants(
  participants: LayoutParticipant[],
  pinnedUsers: string[],
  activeSpeakerId: string | null
): LayoutParticipant[] {
  return [...participants].sort((a, b) => {
    // 1. Pinned priority
    const aPinned = pinnedUsers.includes(a.id);
    const bPinned = pinnedUsers.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // 2. Active Speaker priority
    const aSpeaker = a.id === activeSpeakerId;
    const bSpeaker = b.id === activeSpeakerId;
    if (aSpeaker && !bSpeaker) return -1;
    if (!aSpeaker && bSpeaker) return 1;

    // 3. Hand Raised priority
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;

    // 4. Video Enabled priority
    if (a.isVideoEnabled && !b.isVideoEnabled) return -1;
    if (!a.isVideoEnabled && b.isVideoEnabled) return 1;

    // 5. Last spoke timestamp priority
    const aSpoke = a.lastSpokeAt || 0;
    const bSpoke = b.lastSpokeAt || 0;
    if (aSpoke !== bSpoke) {
      return bSpoke - aSpoke;
    }

    // 6. Local user last
    if (a.isLocal && !b.isLocal) return 1;
    if (!a.isLocal && b.isLocal) return -1;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Optimizes rows/cols to fit N items in container width/height while maximizing area
 * and maintaining target aspect ratio.
 */
export function optimizeGrid(
  count: number,
  containerW: number,
  containerH: number,
  targetAspect: number
): { cols: number; rows: number; tileW: number; tileH: number } {
  if (count <= 0) return { cols: 1, rows: 1, tileW: 0, tileH: 0 };

  let maxArea = 0;
  let bestCols = 1;
  let bestRows = 1;
  let bestTileW = 0;
  let bestTileH = 0;

  // Scan all possible column counts
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = containerW / cols;
    const cellH = containerH / rows;

    // Fit aspect ratio inside grid cell
    const tileW = Math.min(cellW, cellH * targetAspect);
    const tileH = tileW / targetAspect;
    const area = tileW * tileH;

    if (area > maxArea) {
      maxArea = area;
      bestCols = cols;
      bestRows = rows;
      bestTileW = tileW;
      bestTileH = tileH;
    }
  }

  return {
    cols: bestCols,
    rows: bestRows,
    tileW: bestTileW,
    tileH: bestTileH,
  };
}

/**
 * Generates layout coordinates for a centered grid, centering the last row items horizontally.
 */
function fitGrid(
  ids: { id: string; type: 'video' | 'screen' }[],
  containerW: number,
  containerH: number,
  aspect: number,
  yOffsetStart: number = 0,
  zIndex: number = 1
): LayoutItem[] {
  const count = ids.length;
  if (count === 0) return [];

  const { cols, rows, tileW, tileH } = optimizeGrid(count, containerW, containerH, aspect);

  const gridW = cols * tileW;
  const gridH = rows * tileH;
  const startX = (containerW - gridW) / 2;
  const startY = yOffsetStart + (containerH - gridH) / 2;

  const items: LayoutItem[] = [];

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;

    // Check if we are on the last row and it is not full
    const isLastRow = r === rows - 1;
    const itemsInLastRow = count - r * cols;
    
    let x = startX + c * tileW;
    
    if (isLastRow && itemsInLastRow < cols) {
      // Center the remaining items of the last row horizontally
      const lastRowGridW = itemsInLastRow * tileW;
      const lastRowStartX = (containerW - lastRowGridW) / 2;
      x = lastRowStartX + c * tileW;
    }

    const y = startY + r * tileH;

    items.push({
      id: ids[i].id,
      type: ids[i].type,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(tileW),
      height: Math.round(tileH),
      zIndex,
    });
  }

  return items;
}

export function calculateLayout(params: LayoutEngineParams): LayoutItem[] {
  const {
    participants,
    screenShares,
    pinnedUsers,
    activeSpeakerId,
    viewportWidth,
    viewportHeight,
    mode,
  } = params;

  if (viewportWidth <= 0 || viewportHeight <= 0) return [];

  // Determine aspect ratio dynamically (portrait for portrait layout, landscape for landscape)
  const isPortraitViewport = viewportWidth < viewportHeight;
  const targetAspect = isPortraitViewport ? 3 / 4 : 16 / 9;

  // 1. Sort participants by priority
  const sortedPart = sortParticipants(participants, pinnedUsers, activeSpeakerId);

  // 2. Identify active focus elements
  const activePins = sortedPart.filter((p) => pinnedUsers.includes(p.id));
  const activeSpeaker = sortedPart.find((p) => p.id === activeSpeakerId) || sortedPart[0];

  // 3. Fallback layout matching depending on screen sharing activity
  let activeMode = mode;
  if (screenShares.length > 0 && activeMode === 'grid') {
    activeMode = 'presenter'; // Auto-switch to presenter if screen shares are active
  }

  // --- Layout Implementations ---

  // SPOTLIGHT LAYOUT
  if (activeMode === 'spotlight') {
    const focusId = activePins.length > 0 
      ? activePins[0].id 
      : (activeSpeaker ? activeSpeaker.id : '');

    if (!focusId) return [];

    return [{
      id: focusId,
      type: 'video',
      x: 0,
      y: 0,
      width: viewportWidth,
      height: viewportHeight,
      zIndex: 1,
    }];
  }

  // CONTENT-FIRST LAYOUT (Screen share only grid, ignore camera feeds)
  if (activeMode === 'content-first') {
    if (screenShares.length === 0) {
      // Fallback to grid layout if no screen shares exist
      return fitGrid(
        sortedPart.map((p) => ({ id: p.id, type: 'video' })),
        viewportWidth,
        viewportHeight,
        targetAspect
      );
    }

    return fitGrid(
      screenShares.map((s) => ({ id: s.id, type: 'screen' })),
      viewportWidth,
      viewportHeight,
      16 / 9 // Screens are always 16:9
    );
  }

  // PRESENTER LAYOUT (Screen shares in grid, cameras in horizontal filmstrip)
  if (activeMode === 'presenter') {
    if (screenShares.length === 0) {
      // Fallback to grid layout if no screen shares exist
      return fitGrid(
        sortedPart.map((p) => ({ id: p.id, type: 'video' })),
        viewportWidth,
        viewportHeight,
        targetAspect
      );
    }

    // Allocate 82% height to screen shares, 18% to filmstrip
    const filmstripH = Math.round(viewportHeight * 0.18);
    const contentH = viewportHeight - filmstripH;

    // Layout screens
    const screenItems = fitGrid(
      screenShares.map((s) => ({ id: s.id, type: 'screen' })),
      viewportWidth,
      contentH,
      16 / 9,
      0,
      2
    );

    // Layout cameras in bottom horizontal filmstrip
    const cameraIds = sortedPart.map((p) => ({ id: p.id, type: 'video' }));
    const tileAspect = 16 / 9;
    const tileW = Math.round(filmstripH * tileAspect * 0.85); // slightly smaller than full height
    const tileH = Math.round(tileW / tileAspect);

    const totalFilmstripW = cameraIds.length * tileW;
    const startX = totalFilmstripW < viewportWidth 
      ? (viewportWidth - totalFilmstripW) / 2 
      : 0;

    const cameraItems: LayoutItem[] = cameraIds.map((item, idx) => ({
      id: item.id,
      type: 'video',
      x: Math.round(startX + idx * tileW),
      y: Math.round(contentH + (filmstripH - tileH) / 2),
      width: tileW,
      height: tileH,
      zIndex: 1,
    }));

    return [...screenItems, ...cameraItems];
  }

  // SIDEBAR LAYOUT (Focused tile on left, filmstrip on right)
  if (activeMode === 'sidebar') {
    if (sortedPart.length === 0) return [];

    const focusParticipant = activePins.length > 0 ? activePins[0] : activeSpeaker;
    if (!focusParticipant) return [];

    // Right sidebar width is 24% of viewport width
    const sidebarW = Math.round(viewportWidth * 0.24);
    const mainW = viewportWidth - sidebarW;

    // Focus Tile
    const focusItem: LayoutItem = {
      id: focusParticipant.id,
      type: 'video',
      x: 0,
      y: 0,
      width: mainW,
      height: viewportHeight,
      zIndex: 2,
    };

    // Sidebar Items
    const sidebarPart = sortedPart.filter((p) => p.id !== focusParticipant.id);
    const tileAspect = 16 / 9;
    const tileW = sidebarW - 16; // Margins
    const tileH = Math.round(tileW / tileAspect);

    const sidebarItems: LayoutItem[] = sidebarPart.map((p, idx) => ({
      id: p.id,
      type: 'video',
      x: Math.round(mainW + 8),
      y: Math.round(idx * (tileH + 8) + 8),
      width: tileW,
      height: tileH,
      zIndex: 1,
    }));

    return [focusItem, ...sidebarItems];
  }

  // PICTURE-IN-PICTURE (PiP) LAYOUT (Primary takes background, secondary floats in corner)
  if (activeMode === 'pip') {
    if (sortedPart.length === 0) return [];

    // Main background user (e.g., remote participant)
    const backgroundUser = sortedPart.find((p) => !p.isLocal) || sortedPart[0];
    const backgroundItem: LayoutItem = {
      id: backgroundUser.id,
      type: 'video',
      x: 0,
      y: 0,
      width: viewportWidth,
      height: viewportHeight,
      zIndex: 1,
    };

    // Floating corner user (e.g. local participant)
    const floatingUser = sortedPart.find((p) => p.id !== backgroundUser.id);
    if (!floatingUser) {
      return [backgroundItem];
    }

    // PIP tile dimensions: 20% of viewport
    const pipW = Math.round(viewportWidth * 0.22);
    const pipH = Math.round(pipW * (9 / 16));

    const floatingItem: LayoutItem = {
      id: floatingUser.id,
      type: 'video',
      x: Math.round(viewportWidth - pipW - 16), // Bottom-right corner offset
      y: Math.round(viewportHeight - pipH - 16),
      width: pipW,
      height: pipH,
      zIndex: 10, // Top layer
    };

    return [backgroundItem, floatingItem];
  }

  // GRID LAYOUT (Standard optimized grid)
  return fitGrid(
    sortedPart.map((p) => ({ id: p.id, type: 'video' })),
    viewportWidth,
    viewportHeight,
    targetAspect
  );
}
