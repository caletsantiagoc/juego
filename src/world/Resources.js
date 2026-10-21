import { ITEMS_DATABASE } from '../systems/Inventory.js';

export class ResourceNode {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type; // 'tree', 'rock', 'iron_vein', 'gold_vein', 'bush', 'herb', 'water_source'
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.maxHealth = this.getDefaultHealth();
    this.health = this.maxHealth;
    this.depleted = false;
    this.respawnTimer = 0;
    this.respawnTime = 60; // 60 seconds respawn
    this.shake = 0;
  }

  getDefaultHealth() {
    switch (this.type) {
      case 'tree': return 3;
      case 'rock': return 4;
      case 'iron_vein': return 4;
      case 'gold_vein': return 5;
      case 'bush': return 1;
      case 'herb': return 1;
      case 'water_source': return 999;
      default: return 2;
    }
  }

  harvest(damage = 1, toolType = null) {
    if (this.depleted) return [];

    // Bonus damage if using proper tool
    let effectiveDmg = damage;
    if (this.type === 'tree' && toolType === 'axe') effectiveDmg *= 2;
    if ((this.type === 'rock' || this.type.includes('vein')) && toolType === 'pickaxe') effectiveDmg *= 2;

    this.health -= effectiveDmg;
    this.shake = 6;

    if (this.health <= 0) {
      this.depleted = true;
      this.respawnTimer = this.respawnTime;
      return this.getDrops();
    }
    return [];
  }

  getDrops() {
    const drops = [];
    switch (this.type) {
      case 'tree':
        drops.push({ id: 'wood', count: 3 + Math.floor(Math.random() * 2) });
        if (Math.random() < 0.45) drops.push({ id: 'apple', count: 1 });
        break;
      case 'rock':
        drops.push({ id: 'stone', count: 3 + Math.floor(Math.random() * 2) });
        if (Math.random() < 0.35) drops.push({ id: 'iron_ore', count: 1 });
        break;
      case 'iron_vein':
        drops.push({ id: 'iron_ore', count: 2 + Math.floor(Math.random() * 2) });
        drops.push({ id: 'stone', count: 1 });
        break;
      case 'gold_vein':
        drops.push({ id: 'gold_ore', count: 2 + Math.floor(Math.random() * 2) });
        drops.push({ id: 'stone', count: 2 });
        break;
      case 'bush':
        drops.push({ id: 'berry', count: 2 + Math.floor(Math.random() * 2) });
        drops.push({ id: 'grass', count: 1 });
        break;
      case 'herb':
        drops.push({ id: 'grass', count: 2 });
        break;
      case 'water_source':
        drops.push({ id: 'water_bottle', count: 1 });
        break;
    }
    return drops;
  }

  update(dt) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 25);
    }
    if (this.depleted && this.type !== 'water_source') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.depleted = false;
        this.health = this.maxHealth;
      }
    }
  }

  render(ctx, camera) {
    if (this.depleted) {
      // Stump or broken rock
      const screenX = this.x - camera.x;
      const screenY = this.y - camera.y;
      if (this.type === 'tree') {
        ctx.fillStyle = '#6b4423';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const offsetX = (Math.random() - 0.5) * this.shake;
    const screenX = this.x - camera.x + offsetX;
    const screenY = this.y - camera.y;

    // Viewport bounds check
    if (
      screenX < -50 || screenX > ctx.canvas.width + 50 ||
      screenY < -50 || screenY > ctx.canvas.height + 50
    ) {
      return;
    }

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 12, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (this.type) {
      case 'tree':
        // Tree Trunk
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(screenX - 6, screenY - 10, 12, 22);

        // Canopy Layer 1 (bottom green)
        ctx.fillStyle = '#2d6a4f';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 14, 22, 0, Math.PI * 2);
        ctx.fill();

        // Canopy Layer 2 (top lighter green)
        ctx.fillStyle = '#40916c';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 24, 17, 0, Math.PI * 2);
        ctx.fill();

        // Apples in tree
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.arc(screenX - 8, screenY - 18, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 7, screenY - 25, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'rock':
        // Rock boulder
        ctx.fillStyle = '#6c757d';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#adb5bd';
        ctx.beginPath();
        ctx.ellipse(screenX - 4, screenY - 4, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'iron_vein':
        // Rock with silver-iron glints
        ctx.fillStyle = '#495057';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 19, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ced4da';
        ctx.fillRect(screenX - 6, screenY - 5, 5, 5);
        ctx.fillRect(screenX + 4, screenY + 2, 4, 4);
        break;

      case 'gold_vein':
        // Rock with gold glints
        ctx.fillStyle = '#343a40';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 19, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(screenX - 5, screenY - 6, 6, 6);
        ctx.fillRect(screenX + 3, screenY + 1, 5, 5);
        break;

      case 'bush':
        // Berry bush
        ctx.fillStyle = '#52b788';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 14, 0, Math.PI * 2);
        ctx.fill();
        // Red berries
        ctx.fillStyle = '#d90429';
        ctx.beginPath();
        ctx.arc(screenX - 5, screenY - 4, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 4, screenY - 2, 3, 0, Math.PI * 2);
        ctx.arc(screenX, screenY + 4, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'herb':
        // Medicinal herb plant
        ctx.fillStyle = '#74c69d';
        ctx.beginPath();
        ctx.arc(screenX - 4, screenY, 6, 0, Math.PI * 2);
        ctx.arc(screenX + 4, screenY, 6, 0, Math.PI * 2);
        ctx.arc(screenX, screenY - 5, 7, 0, Math.PI * 2);
        ctx.fill();
        // Flower blossom
        ctx.fillStyle = '#b5179e';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'water_source':
        // Village fountain / fresh spring
        ctx.fillStyle = '#6c757d';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00b4d8';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 15, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}

export class DroppedItem {
  constructor(id, itemId, count, x, y) {
    this.id = id;
    this.itemId = itemId;
    this.count = count;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.floatTimer = Math.random() * Math.PI * 2;
    this.despawnTimer = 180; // 3 minutes despawn
  }

  update(dt) {
    this.floatTimer += dt * 4;
    this.y = this.baseY + Math.sin(this.floatTimer) * 4;
    this.despawnTimer -= dt;
  }

  render(ctx, camera) {
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    const itemData = ITEMS_DATABASE[this.itemId];
    if (!itemData) return;

    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(screenX, this.baseY + 6 - camera.y, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Floating item icon
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemData.icon, screenX, screenY);

    if (this.count > 1) {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(this.count, screenX + 8, screenY + 6);
    }
    ctx.restore();
  }
}
