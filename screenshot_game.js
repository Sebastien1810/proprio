const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  const p1 = await browser.newPage();
  await p1.setViewportSize({ width: 1280, height: 800 });

  // Create room via API
  const createRes = await p1.request.post('http://localhost:3000/api/rooms', {
    data: { playerName: 'Alice' },
    headers: { 'Content-Type': 'application/json' },
  });
  const createData = await createRes.json();
  console.log('Room created:', createData.room?.id, 'Code:', createData.room?.code);

  const roomId = createData.room.id;
  const joinCode = createData.room.code;
  const p1Id = createData.player.id;

  // Player 2 joins via API
  const p2 = await browser.newPage();
  await p2.setViewportSize({ width: 1280, height: 800 });
  const joinRes2 = await p2.request.post('http://localhost:3000/api/rooms/join', {
    data: { playerName: 'Bob', code: joinCode },
    headers: { 'Content-Type': 'application/json' },
  });
  const joinData2 = await joinRes2.json();
  const p2Id = joinData2.player.id;
  console.log('Bob joined:', p2Id);

  // Player 3 joins via API
  const p3 = await browser.newPage();
  await p3.setViewportSize({ width: 1280, height: 800 });
  const joinRes3 = await p3.request.post('http://localhost:3000/api/rooms/join', {
    data: { playerName: 'Charlie', code: joinCode },
    headers: { 'Content-Type': 'application/json' },
  });
  const joinData3 = await joinRes3.json();
  const p3Id = joinData3.player.id;
  console.log('Charlie joined:', p3Id);

  // Navigate pages to lobby
  await p1.goto(`http://localhost:3000/lobby/${roomId}?playerId=${p1Id}`, { waitUntil: 'networkidle' });
  await p2.goto(`http://localhost:3000/lobby/${roomId}?playerId=${p2Id}`, { waitUntil: 'networkidle' });
  await p3.goto(`http://localhost:3000/lobby/${roomId}?playerId=${p3Id}`, { waitUntil: 'networkidle' });

  await p1.waitForTimeout(1500);

  // Find and click start button on p1
  const allBtns = await p1.$$('button');
  let startBtn = null;
  for (const btn of allBtns) {
    const txt = (await btn.textContent()).trim();
    console.log('btn:', txt);
    if (txt.includes('Lancer') || txt.includes('Start') || txt.includes('Commencer') || txt.includes('Démarrer')) {
      startBtn = btn;
    }
  }

  if (startBtn) {
    await startBtn.click();
    console.log('Clicked start');
    await p1.waitForTimeout(2000);
    const curUrl = p1.url();
    console.log('p1 URL after start:', curUrl);
    if (!curUrl.includes('/game/')) {
      // Maybe it navigated differently
      await p1.waitForURL('**/game/**', { timeout: 8000 }).catch(() => {});
    }
  } else {
    console.log('No start button found — listing all visible buttons above');
  }

  await p1.waitForTimeout(2000);
  console.log('Final URL:', p1.url());

  await p1.screenshot({ path: 'C:/Users/sxb_s/dev/Projets_Seb/Proprio/screenshot_fonts.png', fullPage: false });
  console.log('Screenshot saved');

  await browser.close();
})().catch(e => {
  console.error(e.message);
  process.exit(1);
});
