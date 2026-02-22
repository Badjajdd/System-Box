require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===== إعدادات البوت =====
const CONFIG_FILE = './config.json';

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      watchedChannels: {},
      boxes: {
        diamond: { enabled: true, chance: 5,  emoji: '💎', message: 'تم حصولك على صندوق الماس مبرووك.' },
        gold:    { enabled: true, chance: 10, emoji: '🥇', message: 'تم حصولك على صندوق ذهب' },
        silver:  { enabled: true, chance: 20, emoji: '🥈', message: 'تم حصولك على صندوق سلفر' },
        bronze:  { enabled: true, chance: 30, emoji: '🥉', message: 'تم حصولك على صندوق برونزي' },
        nothing: { enabled: true, chance: 35, emoji: '❌', message: 'للأسف، لم يحالفك الحظ هذه المرة ولم تحصل على أي شيء. حظًا أوفر في المرات القادمة!' },
      }
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ===== منطق السحب =====
function rollBox(config) {
  const boxes = config.boxes;
  const totalChance = Object.values(boxes).reduce((sum, b) => b.enabled ? sum + b.chance : sum, 0);
  let rand = Math.random() * totalChance;

  for (const [key, box] of Object.entries(boxes)) {
    if (!box.enabled) continue;
    rand -= box.chance;
    if (rand <= 0) return { key, ...box };
  }
  return { key: 'nothing', ...boxes.nothing };
}

// ===== معالجة الرسائل =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const config = loadConfig();
  const prefix = '!';

  // ===== كوماندات الإدارة =====
  if (message.content.startsWith(prefix)) {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'setchannel') {
      const channel = message.mentions.channels.first() || message.channel;
      config.watchedChannels[message.guild.id] = channel.id;
      saveConfig(config);
      return message.reply(`تم تعيين القناة المراقبة إلى ${channel}`);
    }

    if (cmd === 'removechannel') {
      delete config.watchedChannels[message.guild.id];
      saveConfig(config);
      return message.reply('تم إلغاء القناة المراقبة.');
    }

    if (cmd === 'setchance') {
      const boxName = args[0]?.toLowerCase();
      const chance = parseFloat(args[1]);
      if (!boxName || !config.boxes[boxName]) {
        return message.reply(`اسم الصندوق غير صحيح. الصناديق المتاحة: ${Object.keys(config.boxes).join(', ')}`);
      }
      if (isNaN(chance) || chance < 0) {
        return message.reply('النسبة يجب أن تكون رقم موجب.');
      }
      config.boxes[boxName].chance = chance;
      saveConfig(config);
      return message.reply(`تم تعيين نسبة صندوق **${boxName}** إلى **${chance}**`);
    }

    if (cmd === 'setemoji') {
      const boxName = args[0]?.toLowerCase();
      const emoji = args[1];
      if (!boxName || !config.boxes[boxName]) {
        return message.reply(`اسم الصندوق غير صحيح. الصناديق المتاحة: ${Object.keys(config.boxes).join(', ')}`);
      }
      if (!emoji) return message.reply('يجب تحديد إيموجي.');
      config.boxes[boxName].emoji = emoji;
      saveConfig(config);
      return message.reply(`تم تعيين إيموجي صندوق **${boxName}** إلى ${emoji}`);
    }

    if (cmd === 'setmessage') {
      const boxName = args.shift()?.toLowerCase();
      const newMsg = args.join(' ');
      if (!boxName || !config.boxes[boxName]) {
        return message.reply(`اسم الصندوق غير صحيح. الصناديق المتاحة: ${Object.keys(config.boxes).join(', ')}`);
      }
      if (!newMsg) return message.reply('يجب كتابة الرسالة الجديدة.');
      config.boxes[boxName].message = newMsg;
      saveConfig(config);
      return message.reply(`تم تحديث رسالة صندوق **${boxName}**`);
    }

    if (cmd === 'togglebox') {
      const boxName = args[0]?.toLowerCase();
      if (!boxName || !config.boxes[boxName]) {
        return message.reply(`اسم الصندوق غير صحيح. الصناديق المتاحة: ${Object.keys(config.boxes).join(', ')}`);
      }
      config.boxes[boxName].enabled = !config.boxes[boxName].enabled;
      saveConfig(config);
      const status = config.boxes[boxName].enabled ? 'مفعّل' : 'موقوف';
      return message.reply(`تم تغيير حالة صندوق **${boxName}** إلى: ${status}`);
    }

    if (cmd === 'boxinfo') {
      const watchedChannel = config.watchedChannels[message.guild.id];
      const channelMention = watchedChannel ? `<#${watchedChannel}>` : 'لم يتم التعيين بعد';

      let info = `**إعدادات الصناديق الحالية**\n`;
      info += `القناة المراقبة: ${channelMention}\n\n`;

      const total = Object.values(config.boxes).reduce((s, b) => b.enabled ? s + b.chance : s, 0);
      for (const [key, box] of Object.entries(config.boxes)) {
        const pct = total > 0 ? ((box.chance / total) * 100).toFixed(1) : '0.0';
        const status = box.enabled ? 'مفعّل' : 'موقوف';
        info += `[${status}] ${box.emoji} **${key}** — النسبة: ${box.chance} (${pct}%)\n`;
        info += `   ${box.message}\n\n`;
      }
      return message.reply(info);
    }

    if (cmd === 'help') {
      const help = `
**كوماندات البوت (للمسؤولين فقط)**

\`!setchannel [#channel]\` — تعيين القناة المراقبة
\`!removechannel\` — إلغاء القناة المراقبة
\`!setchance <box> <رقم>\` — تغيير نسبة صندوق
\`!setemoji <box> <إيموجي>\` — تغيير إيموجي صندوق
\`!setmessage <box> <رسالة>\` — تغيير رسالة صندوق
\`!togglebox <box>\` — تفعيل أو إيقاف صندوق
\`!boxinfo\` — عرض إعدادات جميع الصناديق

**أسماء الصناديق:** \`diamond\` | \`gold\` | \`silver\` | \`bronze\` | \`nothing\`
      `.trim();
      return message.reply(help);
    }
  }

  // ===== مراقبة كلمة "بكج" =====
  const watchedChannelId = config.watchedChannels[message.guild?.id];
  if (!watchedChannelId || message.channel.id !== watchedChannelId) return;

  const text = message.content.trim();
  if (text === 'بكج') {
    const result = rollBox(config);
    await message.reply(`${result.emoji} - ${result.message}`);
  }
});

// ===== تشغيل البوت =====
client.once('ready', () => {
  console.log(`البوت شغال كـ ${client.user.tag}`);
});

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('خطأ: يجب تعيين DISCORD_TOKEN في ملف .env');
  process.exit(1);
}

client.login(TOKEN);