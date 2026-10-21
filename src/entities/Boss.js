import { Enemy } from './Enemy.js';

export class Boss {
  constructor(id, x, y) {
    this.id = id;
    this.name = 'Guardián del Bosque';
    this.type = 'boss';
    this.x = x;
    this.y = y;
    this.radius = 32;

    this.maxHealth = 320;
    this.health = this.maxHealth;
    this.damage = 25;
    this.speed = 85;

    this.attackTimer = 0;
    this.slamTimer = 6;
    this.isSlamCharging = false;
    this.slamChargeTime = 0;

    this.hasSummonedMinions = false;
    this.isEnraged = false;
    this.isDead = false;
    this.hurtTimer = 0;
    this.glowTick = 0;
  }

  takeDamage(amount, knockbackAngle = null, game = null) {
    if (this.isDead) return;

    this.health -= amount;
    this.hurtTimer = 0.2;

    if (game && game.particleSystem) {
      game.particleSystem.emitHit(this.x, this.y);
      game.particleSystem.addFloatingText(this.x, this.y - 45, `-${amount}`, '#ff1744', 22);
    }

    // Check enrage threshold (30% HP)
    if (!this.isEnraged && this.health <= this.maxHealth * 0.3) {
      this.isEnraged = true;
      this.speed = 120;
      this.damage = 32;
      if (game && game.soundManager) game.soundManager.playBossRoar();
      if (game && game.hud) game.hud.showToast('¡El Guardián del Bosque entra en Furia Salvaje!', 'toast-danger');
    }

    if (this.health <= 0) {
      this.die(game);
    }
  }

  die(game = null) {
    this.isDead = true;
    this.health = 0;

    if (game) {
      // Massive rewards
      if (game.player) {
        game.player.addXP(500, game);
        game.player.coins += 100;
        if (game.particleSystem) {
          game.particleSystem.addFloatingText(this.x, this.y - 50, '+500 XP  +100 🪙', '#ffd700', 20);
        }
      }

      // Drop Legendary items
      game.spawnDroppedItem('sylvan_blade', 1, this.x - 20, this.y);
      game.spawnDroppedItem('forest_crown', 1, this.x + 20, this.y);
      game.spawnDroppedItem('gold_ore', 5, this.x, this.y + 20);

      if (game.soundManager) {
        game.soundManager.playQuestComplete();
      }

      if (game.hud) {
        game.hud.showToast('¡HAS DERROTADO AL GUARDIÁN DEL BOSQUE!', 'toast-levelup');
        game.hud.hideBossBar();
      }

      // Quest trigger
      if (game.questSystem) {
        game.questSystem.onKill('boss');
      }
    }
  }

  performSlam(game) {
    if (!game) return;

    if (game.soundManager) game.soundManager.playBossRoar();
    if (game.particleSystem) {
      // Ground shockwave particles
      for (let i = 0; i < 40; i++) {
        const ang = (Math.PI * 2 * i) / 40;
        game.particleSystem.emit(this.x, this.y, 1, {
          color: '#2d6a4f',
          minSpeed: 100,
          maxSpeed: 200,
          gravity: 0
        });
      }
    }

    // AOE damage to player if in range
    const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
    if (dist < 130) {
      game.player.takeDamage(35, this.name, game);
      // Push back player
      const angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
      game.player.x += Math.cos(angle) * 35;
      game.player.y += Math.sin(angle) * 35;
    }
  }

  update(dt, player, map, game) {
    if (this.isDead) return;

    this.glowTick += dt * 4;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    // Update Boss HUD display based on proximity
    if (game && game.hud) {
      if (distToPlayer <= 420 && !this.isDead) {
        game.hud.showBossBar(this.name, this.health, this.maxHealth);
      } else {
        game.hud.hideBossBar();
      }
    }

    // Minion summon at 50% HP
    if (!this.hasSummonedMinions && this.health <= this.maxHealth * 0.5) {
      this.hasSummonedMinions = true;
      if (game) {
        game.enemies.push(new Enemy(Date.now() + 1, 'wolf', this.x - 50, this.y));
        game.enemies.push(new Enemy(Date.now() + 2, 'wolf', this.x + 50, this.y));
        if (game.hud) game.hud.showToast('¡El Guardián ha invocado lobos salvajes!', 'toast-danger');
      }
    }

    // Slam Attack Logic
    this.slamTimer -= dt;
    if (this.slamTimer <= 0 && !this.isSlamCharging && distToPlayer < 250) {
      this.isSlamCharging = true;
      this.slamChargeTime = 1.0;
    }

    if (this.isSlamCharging) {
      this.slamChargeTime -= dt;
      if (this.slamChargeTime <= 0) {
        this.isSlamCharging = false;
        this.slamTimer = 7.0;
        this.performSlam(game);
      }
      return; // Standing still while charging slam
    }

    // Normal Chase & Melee
    if (distToPlayer <= 380 && !player.isDead) {
      if (distToPlayer <= 50) {
        if (this.attackTimer <= 0) {
          this.attackTimer = 1.2;
          player.takeDamage(this.damage, this.name, game);
        }
      } else {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const moveX = Math.cos(angle) * this.speed * dt;
        const moveY = Math.sin(angle) * this.speed * dt;

        if (!map.isSolid(this.x + moveX, this.y, 24)) this.x += moveX;
        if (!map.isSolid(this.x, this.y + moveY, 24)) this.y += moveY;
      }
    }
  }

  render(ctx, camera) {
    if (this.isDead) return;

    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    ctx.save();

    // Large shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 28, 34, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Enraged or Slam charging aura
    if (this.isEnraged || this.isSlamCharging) {
      const auraColor = this.isSlamCharging ? 'rgba(255, 183, 3, 0.4)' : 'rgba(230, 57, 70, 0.45)';
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 44 + Math.sin(this.glowTick) * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Massive wooden golem body
    ctx.fillStyle = this.hurtTimer > 0 ? '#ff6b6b' : '#3e2723';
    ctx.fillRect(screenX - 22, screenY - 20, 44, 48);

    // Ancient Bark Plating
    ctx.fillStyle = '#2c1810';
    ctx.fillRect(screenX - 18, screenY - 14, 36, 12);
    ctx.fillRect(screenX - 18, screenY + 6, 36, 14);

    // Head
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.arc(screenX, screenY - 28, 18, 0, Math.PI * 2);
    ctx.fill();

    // Branch Antlers / Horns
    ctx.strokeStyle = '#2c1810';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(screenX - 12, screenY - 38);
    ctx.lineTo(screenX - 26, screenY - 55);
    ctx.moveTo(screenX + 12, screenY - 38);
    ctx.lineTo(screenX + 26, screenY - 55);
    ctx.stroke();

    // Glowing ancient elemental core and eyes
    const eyeColor = this.isEnraged ? '#ff0054' : '#00e676';
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(screenX - 6, screenY - 28, 4, 0, Math.PI * 2);
    ctx.arc(screenX + 6, screenY - 28, 4, 0, Math.PI * 2);
    ctx.fill();

    // Heart Core in chest
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 6 + Math.sin(this.glowTick) * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
