/**
 * 全局可调参数集中存放。
 * 阶段性扩展：每个阶段实现后在这里追加对应参数块。
 */
export const CONFIG = {
  // ───── 游戏循环 ─────
  TICK_HZ: 60,
  MAX_FRAME_CATCHUP: 4,

  // ───── 世界 ─────
  WORLD_RADIUS: 1250,
  DANGER_ZONE_WIDTH: 200,

  // ───── 蛇 ─────
  PLAYER_INITIAL_LENGTH: 10,
  SNAKE_BASE_SPEED: 180, // world units per second
  SEGMENT_SPACING: 14, // world units between body segments
  SEGMENT_RADIUS: 11,
  HEAD_RADIUS: 15,
  MAX_TURN_RATE_RAD: Math.PI * 1.5, // 270°/s
  TRAIL_MAX_ENTRIES: 600,

  // ───── 相机 ─────
  CAMERA_ZOOM_THRESHOLD_LENGTH: 30,
  CAMERA_ZOOM_PER_10_SEGMENTS: 0.05,
  CAMERA_ZOOM_MAX: 1.5,
  CAMERA_LOOKAHEAD_RATIO: 0.1,

  // ───── AI ─────
  AI_DECISION_HZ: 10, // recompute target angle 10 times per second
  AI_SIGHT_RADIUS: 600,
  AI_THREAT_RADIUS: 110,
  AI_THREAT_CONE_HALF: Math.PI / 3, // 60° each side = 120° cone
  AI_WALL_AVOID_MARGIN: 120, // start steering inward when this close to edge
  AI_NOISE_AMPLITUDE: 0.25,
  AI_NOISE_HZ: 2,
  COLLISION_CELL_SIZE: 40,

  // ───── 食物 ─────
  FOOD_COUNT: 500,
  FOOD_RADIUS: 10,
  FOOD_EMOJIS: ['🍎', '🍌', '🍓', '🍇', '🍒'],
  FOOD_EMOJI_SIZE: 22, // px

  // ───── 死亡/重生 ─────
  EXP_ORB_RADIUS: 14,
  EXP_ORB_GAIN: 3,
  EXP_ORB_TTL: 30, // seconds before decay
  EXP_ORB_EVERY_N_SEGMENTS: 3, // drop one orb every N body segments
  PLAYER_DEATH_SCREEN_SEC: 3,
  AI_RESPAWN_DELAY_SEC: 5,
  RESPAWN_INVINCIBLE_SEC: 2,
  SAFE_SPAWN_MIN_DIST_FROM_SNAKES: 500,
  RESPAWN_LENGTH: 10,

  // ───── 加速 ─────
  BOOST_SPEED_MULTIPLIER: 1.7,
  BOOST_LENGTH_DRAIN_PER_SEC: 1,
  BOOST_MIN_LENGTH: 5,
  BOOST_ZOOM_OUT_FACTOR: 1.05, // camera zooms out 5% while boosting
  AI_BOOST_MIN_LENGTH: 15,
  AI_BOOST_DURATION_MIN: 0.5,
  AI_BOOST_DURATION_MAX: 1.0,
  AI_BOOST_FOOD_DIST_THRESHOLD: 70, // px; AI boosts to chase food beyond this

  // ───── 道具 ─────
  ITEM_COUNT: 3,
  ITEM_RADIUS: 16,
  ITEM_PICKUP_RADIUS: 22,
  ITEM_SHIELD_SEC: 5,
  ITEM_MAGNET_SEC: 6,
  ITEM_FREE_BOOST_SEC: 4,
  ITEM_FOOD_RAIN_SEC: 3,
  MAGNET_RADIUS: 200,
  MAGNET_PULL_SPEED: 280, // world units / sec
  FOOD_RAIN_HZ: 6, // foods spawned per second around head
  FOOD_RAIN_RADIUS: 100,

  // ───── 子弹 ─────
  BULLET_SPEED_MULTIPLIER: 2, // ×SNAKE_BASE_SPEED
  BULLET_RANGE: 500, // world units
  BULLET_RADIUS: 8,
  BULLET_HIT_RADIUS: 14, // collision check radius
  BULLET_COOLDOWN_SEC: 3,
  BULLET_MAX_PER_OWNER: 2,

  // ───── 技能按钮 ─────
  SKILL_BTN_RADIUS: 55, // 110 px diameter
  BOOST_BTN_OFFSET_RIGHT: 200, // distance from right edge
  BOOST_BTN_OFFSET_BOTTOM: 100,
  BULLET_BTN_OFFSET_RIGHT: 100,
  BULLET_BTN_OFFSET_BOTTOM: 180,

  // ───── 摇杆 ─────
  JOYSTICK_OFFSET_X: 120, // CSS px from left edge
  JOYSTICK_OFFSET_Y: 120, // CSS px from bottom edge
  JOYSTICK_OUTER_RADIUS: 80, // visual outer ring radius
  JOYSTICK_INNER_RADIUS: 30, // visual stick head radius
  JOYSTICK_RESPONSE_RADIUS: 120, // wider touch capture
  JOYSTICK_DEAD_ZONE: 15,
} as const;

// 玩家小名 —— 在游戏标题、名字标签、死亡屏使用。
// TODO: 阶段 9 改为 localStorage 持久化，目前先硬编码占位。
export const PLAYER_NAME_PLACEHOLDER = '宝贝';
