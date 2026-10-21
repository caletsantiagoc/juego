import { Inventory, ITEMS_DATABASE } from '../systems/Inventory.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 36;
    this.speed = 150; // pixels per second
    this.runSpeed = 240;

    // Direction: 0: Down, 1: Up, 2: Left, 3: Right
    this.direction = 0;
    this.isMoving = false;
    this.isRunning = false;
    this.walkAnimTimer = 0;

    // Core RPG Stats
    this.name = 'Héroe';
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 100;

    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.maxHunger = 100;
    this.hunger = 100;
    this.maxThirst = 100;
    this.thirst = 100;

    this.baseAttack = 8;
    this.baseDefense = 2;
    this.coins = 20;

    // Inventory & Equipment
    this.inventory = new Inventory(24);
    // Give some starting starter items
    this.inventory.addItem('apple', 3);
    this.inventory.addItem('water_bottle', 2);
    this.inventory.addItem('wooden_sword', 1);

    // Equip starter weapon automatically
    this.inventory.equipItem(2);

    // Combat states
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldown = 0.38; // attack speed
    this.attackCooldownTimer = 0;
    this.isDead = false;
    this.hurtTimer = 0;
  }

  getTotalAttack() {
    let atk = this.baseAttack;
    const wep = this.inventory.equipment.weapon;
    if (wep && ITEMS_DATABASE[wep.id]) {
      atk += ITEMS_DATABASE[wep.id].attack || 0;
    }
    const acc = this.inventory.equipment.accessory;
    if (acc && ITEMS_DATABASE[acc.id]) {
      atk += ITEMS_DATABASE[acc.id].attack || 0;
    }
    return atk;
  }

  getTotalDefense() {
    let def = this.baseDefense;
    const arm = this.inventory.equipment.armor;
    if (arm && ITEMS_DATABASE[arm.id]) {
      def += ITEMS_DATABASE[arm.id].defense || 0;
    }
    const acc = this.inventory.equipment.accessory;
    if (acc && ITEMS_DATABASE[acc.id]) {
      def += ITEMS_DATABASE[acc.id].defense || 0;
    }
    return def;
  }

  addXP(amount, game = null) {
    this.xp += amount;
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.levelUp(game);
    }
  }

  levelUp(game = null) {
    this.level += 1;
    this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
    this.maxHealth += 15;
    this.health = this.maxHealth;
    this.baseAttack += 3;
    this.baseDefense += 2;
    this.stamina = this.maxStamina;

    if (game) {
      if (game.soundManager) game.soundManager.playLevelUp();
      if (game.particleSystem) game.particleSystem.emitLevelUp(this.x, this.y);
      if (game.hud) {
        game.hud.showToast(`¡SUBISTE AL NIVEL ${this.level}! Salud, Ataque y Defensa mejorados.`, 'toast-levelup');
      }
    }
  }

  takeDamage(amount, source = 'enemigo', game = null) {
    if (this.isDead) return;

    // Defense mitigates damage
    const def = this.getTotalDefense();
    const effectiveDmg = Math.max(1, Math.round(amount * (100 / (100 + def))));

    this.health = Math.max(0, this.health - effectiveDmg);
    this.hurtTimer = 0.25;

    if (game) {
      if (game.soundManager) game.soundManager.playHit();
      if (game.particleSystem) {
        game.particleSystem.emitHit(this.x, this.y);
        game.particleSystem.addFloatingText(this.x, this.y - 20, `-${effectiveDmg}`, '#ff4d6d', 18);
      }
    }

    if (this.health <= 0) {
      this.die(source, game);
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  feed(amount) {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
  }

  drink(amount) {
    this.thirst = Math.min(this.maxThirst, this.thirst + amount);
  }

  die(source, game = null) {
    this.isDead = true;
    if (game && game.onPlayerDeath) {
      game.onPlayerDeath(source);
    }
  }

  respawn(spawnX, spawnY) {
    this.x = spawnX;
    this.y = spawnY;
    this.health = this.maxHealth;
    this.hunger = 80;
    this.thirst = 80;
    this.stamina = this.maxStamina;
    this.isDead = false;
  }

  attack(game) {
    if (this.isAttacking || this.attackCooldownTimer > 0 || this.isDead) return;

    // Needs stamina to attack
    if (this.stamina < 5) return;
    this.stamina -= 5;

    this.isAttacking = true;
    this.attackTimer = 0.22;
    this.attackCooldownTimer = this.attackCooldown;

    if (game && game.soundManager) {
      game.soundManager.playAttack();
    }

    // Execute combat hitbox check
    if (game && game.combatSystem) {
      game.combatSystem.performPlayerAttack(this);
    }
  }

  update(dt, input, map, game) {
    if (this.isDead) return;

    // Attack cooldown timers
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
    }
    if (this.isAttacking) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
      }
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
    }

    // Movement Input
    let dx = 0;
    let dy = 0;

    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;

    this.isMoving = dx !== 0 || dy !== 0;

    if (this.isMoving) {
      // Set facing direction
      if (Math.abs(dx) > Math.abs(dy)) {
        this.direction = dx > 0 ? 3 : 2; // Right or Left
      } else {
        this.direction = dy > 0 ? 0 : 1; // Down or Up
      }

      // Check sprint
      this.isRunning = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && this.stamina > 10;
      const currentSpeed = this.isRunning ? this.runSpeed : this.speed;

      // Normalize diagonal vector
      const length = Math.hypot(dx, dy);
      const moveX = (dx / length) * currentSpeed * dt;
      const moveY = (dy / length) * currentSpeed * dt;

      // Collision checks against map
      const newX = this.x + moveX;
      const newY = this.y + moveY;

      if (!map.isSolid(newX, this.y, 14)) {
        this.x = newX;
      }
      if (!map.isSolid(this.x, newY, 14)) {
        this.y = newY;
      }

      this.walkAnimTimer += dt * (this.isRunning ? 14 : 9);
    } else {
      this.isRunning = false;
      this.walkAnimTimer = 0;
    }

    // Attack input trigger
    if (input.isJustPressed('Space') || input.isMouseJustPressed()) {
      this.attack(game);
    }
  }

  render(ctx, camera) {
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    ctx.save();

    // Shadow under character
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 14, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hurt red flash
    if (this.hurtTimer > 0) {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.6)';
    }

    // Walk bounce offset
    const bounceY = this.isMoving ? Math.sin(this.walkAnimTimer) * 3 : 0;

    // Body / Tunic
    ctx.fillStyle = this.hurtTimer > 0 ? '#ff6b6b' : '#3a6073';
    ctx.fillRect(screenX - 10, screenY - 6 + bounceY, 20, 18);

    // Belt / details
    ctx.fillStyle = '#b08d57';
    ctx.fillRect(screenX - 10, screenY + 4 + bounceY, 20, 3);

    // Boots
    const stepOffset = this.isMoving ? Math.sin(this.walkAnimTimer) * 4 : 0;
    ctx.fillStyle = '#4a2810';
    ctx.fillRect(screenX - 9, screenY + 12 + stepOffset, 7, 5);
    ctx.fillRect(screenX + 2, screenY + 12 - stepOffset, 7, 5);

    // Head
    ctx.fillStyle = '#fcd5b5';
    ctx.beginPath();
    ctx.arc(screenX, screenY - 14 + bounceY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Helmet
    ctx.fillStyle = '#5c3a21';
    ctx.beginPath();
    ctx.arc(screenX, screenY - 18 + bounceY, 10, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes (based on direction)
    ctx.fillStyle = '#111';
    if (this.direction === 0) { // Down
      ctx.fillRect(screenX - 4, screenY - 14 + bounceY, 2, 3);
      ctx.fillRect(screenX + 2, screenY - 14 + bounceY, 2, 3);
    } else if (this.direction === 2) { // Left
      ctx.fillRect(screenX - 6, screenY - 14 + bounceY, 2, 3);
    } else if (this.direction === 3) { // Right
      ctx.fillRect(screenX + 4, screenY - 14 + bounceY, 2, 3);
    }

    // Weapon rendering & Attack slash arc
    const wep = this.inventory.equipment.weapon;
    const hasSword = wep && wep.id.includes('sword');

    if (this.isAttacking) {
      // Render dynamic slash arc
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();

      let arcStart = 0;
      let arcEnd = Math.PI;

      if (this.direction === 3) { // Right
        arcStart = -Math.PI * 0.35;
        arcEnd = Math.PI * 0.35;
      } else if (this.direction === 2) { // Left
        arcStart = Math.PI * 0.65;
        arcEnd = Math.PI * 1.35;
      } else if (this.direction === 0) { // Down
        arcStart = Math.PI * 0.15;
        arcEnd = Math.PI * 0.85;
      } else if (this.direction === 1) { // Up
        arcStart = Math.PI * 1.15;
        arcEnd = Math.PI * 1.85;
      }

      ctx.arc(screenX, screenY, 32, arcStart, arcEnd);
      ctx.stroke();

      // Blade slash effect
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Held weapon at side
      ctx.fillStyle = '#999';
      if (this.direction === 3) {
        ctx.fillRect(screenX + 11, screenY - 5 + bounceY, 10, 3);
      } else if (this.direction === 2) {
        ctx.fillRect(screenX - 21, screenY - 5 + bounceY, 10, 3);
      }
    }

    ctx.restore();
  }
}
