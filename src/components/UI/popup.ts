// ตำแหน่ง Popup เทียบกับ Tower Spot (หน่วย % ของ Frame) — เปิดด้านบน ยกเว้นเมื่ออยู่ใกล้ขอบบน
export function popupPlacement(
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number,
): { left: string; top: string; below: boolean } {
  const left = Math.min(84, Math.max(16, (x / mapWidth) * 100));
  const top = (y / mapHeight) * 100;
  return { left: `${left}%`, top: `${top}%`, below: y < mapHeight * 0.36 };
}
