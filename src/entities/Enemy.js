export const ENEMY_TYPES = {
  wolf: {
    name: 'Lobo Salvaje',
    maxHealth: 35,
    damage: 10,
    speed: 130,
    detectRadius: 200,
    attackRadius: 36,
    attackCooldown: 1.2,
    xpReward: 35,
    goldDrop: [2, 6],
    loot: [
      { id: 'raw_meat', count: 1, chance: 0.8 },
      { id: 'grass', count: 1, chance: 0.5 }
    ]
  },
  zombie: {
    name: 'Zombi Errante',
    maxHealth: 60,
    damage: 14,
    speed: 75,
    detectRadius: 170,
    attackRadius: 32,
    attackCooldown: 1.4,
    xpReward: 45,
    goldDrop: [4, 12],
    loot: [
      { id: 'stone', count: 2, chance: 0.5 },
      { id: 'iron_ore', count: 1, chance: 0.3 }
    ]
  },
  bandit: {
    name: 'Bandido Furtivo',
    maxHealth: 50,
    damage: 16,
    speed: 120,
    detectRadius: 210,
    attackRadius: 38,
    attackCooldown: 1.0,
    xpReward: 55,
    goldDrop: [12, 25],
    loot: [
      { id: 'bandage', count: 1, chance: 0.5 },
      { id: 'water_bottle', count: 1, chance: 0.4 }
    ]
  },
  forest_monster: {
    name: 'Espíritu del Bosque',
    maxHealth: 85,
    damage: 20,
    speed: 90,
    detectRadius: 220,
    attackRadius: 40,
    attackCooldown: 1.4,
    xpReward: 80,
    goldDrop: [15, 30],
    loot: [
      { id: 'wood', count: 4, chance: 1.0 },
      { id: 'berry', count: 3, chance: 0.7 }
    ]
  }
};

export class Enemy {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    this.config = ENEMY_TYPES[type] || ENEMY_TYPES.wolf;

    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.radius = 16;

    this.maxHealth = this.config.maxHealth;
    this.health = this.maxHealth;
    this.damage = this.config.damage;
    this.speed = this.config.speed;

    this.state = 'idle'; // 'idle', 'chase', 'attack', 'dead'
    this.target = null;
    this.attackTimer = 0;
    this.wanderTimer = Math.random() * 3;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.hurtTimer = 0;
    this.isDead = false;
  }

  takeDamage(amount, knockbackAngle = null, game = null) {
    if (this.isDead) return;

    this.health -= amount;
    this.hurtTimer = 0.2;

    if (knockbackAngle !== null) {
      this.x += Math.cos(knockbackAngle) * 16;
      this.y += Math.sin(knockbackAngle) * 16;
    }

    if (game && game.particleSystem) {
      game.particleSystem.emitHit(this.x, this.y);
      game.particleSystem.addFloatingText(this.x, this.y - 18, `-${amount}`, '#ff4d6d', 16);
    }

    if (this.health <= 0) {
      this.die(game);
    }
  }

  die(game = null) {
    this.isDead = true;
    this.health = 0;

    if (game) {
      // Award XP
      if (game.player) {
        game.player.addXP(this.config.xpReward, game);
      }

      // Drop Gold
      const [minG, maxG] = this.config.goldDrop;
      const gold = Math.floor(minG + Math.random() * (maxG - minG + 1));
      if (game.player) {
        game.player.coins += gold;
        if (game.particleSystem) {
          game.particleSystem.addFloatingText(this.x, this.y - 34, `+${gold} 🪙`, '#ffd700', 15);
        }
      }

      // Drop Loot Items
      for (const drop of this.config.loot) {
        if (Math.random() <= drop.chance) {
          game.spawnDroppedItem(drop.id, drop.count, this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20);
        }
      }

      // Quest hook
      if (game.questSystem) {
        game.questSystem.onKill(this.type);
      }
    }
  }

  update(dt, player, map, game) {
    if (this.isDead) return;

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    // AI Logic
    if (distToPlayer <= this.config.detectRadius && !player.isDead) {
      // In Chase Range
      this.state = 'chase';

      if (distToPlayer <= this.config.attackRadius) {
        // Attack Range
        this.state = 'attack';
        if (this.attackTimer <= 0) {
          this.attackTimer = this.config.attackCooldown;
          player.takeDamage(this.damage, this.config.name, game);
        }
      } else {
        // Move towards player
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const moveX = Math.cos(angle) * this.speed * dt;
        const moveY = Math.sin(angle) * this.speed * dt;

        if (!map.isSolid(this.x + moveX, this.y, 14)) this.x += moveX;
        if (!map.isSolid(this.x, this.y + moveY, 14)) this.y += moveY;
      }
    } else {
      // Idle / Wander near spawn
      this.state = 'idle';
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 3.5;
        this.wanderAngle = Math.random() * Math.PI * 2;
      }

      // Gentle wander
      const distFromSpawn = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);
      if (distFromSpawn > 120) {
        this.wanderAngle = Math.atan2(this.spawnY - this.y, this.spawnX - this.x);
      }

      const moveX = Math.cos(this.wanderAngle) * (this.speed * 0.3) * dt;
      const moveY = Math.sin(this.wanderAngle) * (this.speed * 0.3) * dt;

      if (!map.isSolid(this.x + moveX, this.y, 12)) this.x += moveX;
      if (!map.isSolid(this.x, this.y + moveY, 12)) this.y += moveY;
    }
  }

  render(ctx, camera) {
    if (this.isDead) return;

    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    // Viewport cull
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
    ctx.ellipse(screenX, screenY + 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red hurt flash
    if (this.hurtTimer > 0) {
      ctx.fillStyle = '#ff4d6d';
    }

    switch (this.type) {
      case 'wolf':
        // Wolf body
        ctx.fillStyle = this.hurtTimer > 0 ? '#ff6b6b' : '#6c757d';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 18, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wolf head & snout
        ctx.beginPath();
        ctx.arc(screenX + 12, screenY - 5, 9, 0, Math.PI * 2);
        ctx.fill();

        // Pointed ears
        ctx.fillStyle = '#495057';
        ctx.beginPath();
        ctx.moveTo(screenX + 10, screenY - 14);
        ctx.lineTo(screenX + 14, screenY - 8);
        ctx.lineTo(screenX + 7, screenY - 8);
        ctx.fill();

        // Glowing predatory eyes
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(screenX + 14, screenY - 6, 2, 2);
        break;

      case 'zombie':
        // Rotting greenish body
        ctx.fillStyle = this.hurtTimer > 0 ? '#ff6b6b' : '#386641';
        ctx.fillRect(screenX - 8, screenY - 8, 16, 20);

        // Head
        ctx.fillStyle = '#52b788';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 14, 9, 0, Math.PI * 2);
        ctx.fill();

        // Glowing red eyes
        ctx.fillStyle = '#d90429';
        ctx.fillRect(screenX - 3, screenY - 15, 2, 2);
        ctx.fillRect(screenX + 2, screenY - 15, 2, 2);
        break;

      case 'bandit':
        // Cloaked bandit
        ctx.fillStyle = this.hurtTimer > 0 ? '#ff6b6b' : '#212529';
        ctx.fillRect(screenX - 9, screenY - 7, 18, 20);

        // Masked face
        ctx.fillStyle = '#d4a373';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 13, 8, 0, Math.PI * 2);
        ctx.fill();

        // Black headband / mask
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX - 8, screenY - 15, 16, 6);

        // Dagger
        ctx.fillStyle = '#ced4da';
        ctx.fillRect(screenX + 10, screenY, 8, 3);
        break;

      case 'forest_monster':
        // Dark bark treant body
        ctx.fillStyle = this.hurtTimer > 0 ? '#ff6b6b' : '#3e2723';
        ctx.fillRect(screenX - 12, screenY - 12, 24, 26);

        // Spikes / foliage on back
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 18, 12, 0, Math.PI * 2);
        ctx.fill();

        // Glowing green elemental eye
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(screenX, screenY - 6, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    // Health bar overhead
    const barWidth = 32;
    const barHeight = 4;
    const hpPercent = Math.max(0, this.health / this.maxHealth);

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(screenX - barWidth / 2, screenY - 26, barWidth, barHeight);

    ctx.fillStyle = hpPercent > 0.5 ? '#52b788' : hpPercent > 0.25 ? '#ffd166' : '#e63946';
    ctx.fillRect(screenX - barWidth / 2, screenY - 26, barWidth * hpPercent, barHeight);

    // Name tag
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(this.config.name, screenX, screenY - 30);

    ctx.restore();
  }
}
