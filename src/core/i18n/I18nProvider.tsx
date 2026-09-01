import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * Tiny i18n — English strings are the keys; the ID dictionary maps
 * them to Indonesian. Any missing key gracefully falls back to the
 * English text itself, so a forgotten translation can never crash
 * or blank the UI.
 */

export type AppLanguage = 'en' | 'id';

const STORAGE_KEY = 'mikrokosmos.language';

/** Indonesian translations. English = the key itself. */
const ID: Record<string, string> = {
  // ── Tabs ────────────────────────────────────────────────────────
  'Home': 'Beranda',
  'Self Love': 'Cinta Diri',
  'Mikrokosmos': 'Mikrokosmos',
  'Trends': 'Tren',
  'Me': 'Aku',

  // ── Greetings / dates ──────────────────────────────────────────
  'Good Morning': 'Selamat Pagi',
  'Good Afternoon': 'Selamat Siang',
  'Good Evening': 'Selamat Malam',
  'Good Night': 'Selamat Malam',
  'now': 'baru saja',
  'yesterday': 'kemarin',
  'Today': 'Hari Ini',

  // ── Common ─────────────────────────────────────────────────────
  'Save': 'Simpan',
  'Cancel': 'Batal',
  'Done': 'Selesai',
  'Remove': 'Hapus',
  'Delete': 'Hapus',
  'Stay': 'Tetap di sini',
  'Log Out': 'Keluar',
  'Log out': 'Keluar',
  'Try again': 'Coba lagi',
  'Signal lost': 'Sinyal terputus',
  'Promise': 'Janji',
  'Not yet': 'Belum',
  'Maybe Later': 'Nanti Saja',
  'Progress': 'Kemajuan',
  'Starting': 'Mulai',

  // ── Self Love ──────────────────────────────────────────────────
  "Today's Self Love 💗": 'Cinta Diri Hari Ini 💗',
  'Small acts of care, one day at a time.': 'Kebiasaan kecil merawat diri, sedikit demi sedikit.',
  'Calories': 'Kalori',
  'Water': 'Air',
  '💧 Water': '💧 Air',
  'Steps': 'Langkah',
  '👟 Steps': '👟 Langkah',
  'glasses': 'gelas',
  'steps': 'langkah',
  '1 Glass': '1 Gelas',
  'Wake Up': 'Bangun Tidur',
  '😊 Check in to share your mood': '😊 Check-in untuk berbagi suasana hatimu',
  'My Body 🌸': 'Tubuhku 🌸',
  'days to healthy range': 'hari lagi ke rentang sehat',
  'kcal target': 'target kkal',
  'kg / week': 'kg / minggu',
  'maintaining': 'mempertahankan',
  'Tap to adjust your numbers — private, always 💗':
    'Ketuk untuk atur angkamu — selalu privat 💗',
  'Smart calorie target ✨': 'Target kalori cerdas ✨',
  "Add your height, weight and goal — we'll compute a kind daily target just for you (only you can see it).":
    'Isi tinggi, berat, dan tujuanmu — kami hitung target harian yang menyenangkan khusus untukmu (hanya kamu yang bisa melihat).',
  "Enter today's steps": 'Isi langkah hari ini',
  'Apple Health & Google Health Connect coming later ✨':
    'Apple Health & Google Health Connect menyusul ✨',
  "Today's Performance": 'Performa Hari Ini',
  'Every little thing you did today counts.': 'Setiap hal kecil yang kamu lakukan hari ini berarti.',
  'Food Diary': 'Diary Makanan',
  '+ Add Meal': '+ Tambah Makanan',
  'Nothing logged yet': 'Belum ada catatan',
  'Your tummy deserves a spotlight. Add your first meal!':
    'Perutmu layak jadi bintang. Tambahkan makanan pertamamu!',
  "Today's Total": 'Total Hari Ini',
  'Our Group Progress': 'Progres Grup Kita',
  "We're doing great today! ✨": 'Hari ini kita hebat! ✨',
  'Growing together, one small step at a time 🌿': 'Tumbuh bersama, satu langkah kecil setiap kali 🌿',
  'Could not load your self love space.': 'Gagal memuat ruang cinta dirimu.',
  'Preparing your self love space…': 'Menyiapkan ruang cinta dirimu…',
  'Remove this meal?': 'Hapus makanan ini?',
  'Keep it': 'Simpan',
  'Doing Great': 'Kerja Bagus',

  // ── Chat ───────────────────────────────────────────────────────
  'Opening the group chat…': 'Membuka chat grup…',
  'Could not open the chat.': 'Gagal membuka chat.',
  'Say something cute…': 'Katakan sesuatu yang manis…',
  'thinking…': 'sedang berpikir…',
  'Friend': 'Teman',

  // ── Trends ─────────────────────────────────────────────────────
  'Could not load trends.': 'Gagal memuat tren.',
  'Gathering the fun list…': 'Mengumpulkan daftar seru…',
  'No trends yet': 'Belum ada tren',
  "Found something fun on TikTok?\nSave it here so you don't forget.":
    'Menemukan hal seru di TikTok?\nSimpan di sini biar tidak lupa.',
  '+ Add Trend': '+ Tambah Tren',
  'New Trend ✨': 'Tren Baru ✨',
  'Trend title': 'Judul tren',
  'Link (TikTok / Instagram / YouTube…)': 'Tautan (TikTok / Instagram / YouTube…)',
  "That link doesn't look right — it should start with https://":
    'Tautannya sepertinya kurang tepat — harus diawali https://',
  'Description (optional)': 'Deskripsi (opsional)',
  'Target date (YYYY-MM-DD, optional)': 'Tanggal target (YYYY-MM-DD, opsional)',
  "Who's in?": 'Siapa yang ikut?',
  'Add Trend ✨': 'Tambah Tren ✨',

  // ── Trend detail ───────────────────────────────────────────────
  'Could not open this trend.': 'Gagal membuka tren ini.',
  'Opening the trend…': 'Membuka tren…',
  'Remove this task?': 'Hapus langkah ini?',
  'Delete this trend?': 'Hapus tren ini?',
  'Add a step…': 'Tambahkan langkah…',
  'Save Memory 💌': 'Simpan Kenangan 💌',
  '"{trend.title}" is officially done. Want to save this moment to Mikrokosmos Memories?':
    '"{trend.title}" resmi selesai. Mau simpan momen ini ke Mikrokosmos Memories?',
  'This trend drifted away.': 'Tren ini sudah menghilang.',

  'Update Password': 'Perbarui Kata Sandi',
  'All': 'Semua',
  'Log out?': 'Keluar?',
  'Log out? You can always come back to your universe ✨':
    'Keluar? Kamu selalu bisa kembali ke semestamu ✨',
  'You can always come back to your universe ✨': 'Kamu selalu bisa kembali ke semestamu ✨',
  'New password needs at least 6 characters ✨': 'Kata sandi baru butuh minimal 6 karakter ✨',
  'Password updated 🔐': 'Kata sandi diperbarui 🔐',
  'Your universe is safe.': 'Semestamu aman.',
  'What friends call you': 'Panggilan dari teman-teman',
  'A tiny line about you…': 'Satu kalimat kecil tentangmu…',
  'Day Streak': 'Hari Beruntun',
  'Self Love Days': 'Hari Cinta Diri',
  'Meals Logged': 'Makanan Tercatat',
  'Trends Done': 'Tren Selesai',
  'Made with 💗 by Namy, Kyra & Jessy': 'Dibuat dengan 💗 oleh Namy, Kyra & Jessy',
  'Change Password 🔐': 'Ganti Kata Sandi 🔐',

  // ── Calendar ───────────────────────────────────────────────────
  'Could not open the calendar.': 'Gagal membuka kalender.',
  'Unfolding the calendar…': 'Membuka kalender…',
  'A quiet day': 'Hari yang tenang',
  "Nothing was logged this day — and that's okay.":
    'Tidak ada catatan di hari ini — tidak apa-apa.',

  // ── Memories ───────────────────────────────────────────────────
  'Could not open the scrapbook.': 'Gagal membuka scrapbook.',
  'Opening the scrapbook…': 'Membuka scrapbook…',
  'Remove this memory?': 'Hapus kenangan ini?',
  'No memories yet': 'Belum ada kenangan',
  'Finish a trend together and save the moment, or add one by hand.\nIt will live here, cozy forever.':
    'Selesaikan tren bersama lalu simpan momennya, atau tambahkan sendiri.\nSemuanya akan tersimpan rapi di sini selamanya.',
  'Save a Memory 💌': 'Simpan Kenangan 💌',
  'Give this moment a name': 'Beri nama momen ini',
  'How did it feel? (optional)': 'Bagaimana rasanya? (opsional)',
  'Change photo': 'Ganti foto',
  'Pick a photo': 'Pilih foto',
  'Save to Scrapbook 💗': 'Simpan ke Scrapbook 💗',

  // ── Achievements ───────────────────────────────────────────────
  'Could not load the badge shelf.': 'Gagal memuat rak lencana.',
  'Polishing the badges…': 'Menata lencana…',
  'Just you so far': 'Masih cuma kamu',
  'When your friends join, their badges will shine here too.':
    'Saat teman-temanmu bergabung, lencana mereka akan tampil di sini juga.',

  // ── Friend profile ─────────────────────────────────────────────
  'Could not open this profile.': 'Gagal membuka profil ini.',
  'Visiting your friend…': 'Mengunjungi temanmu…',
  'Mood': 'Suasana Hati',
  'Meals': 'Makanan',

  // ── Login ──────────────────────────────────────────────────────
  'Welcome to Mikrokosmos': 'Selamat Datang di Mikrokosmos',
  'Username': 'Nama Pengguna',
  'Password': 'Kata Sandi',
  'Show password': 'Lihat sandi',
  'Hide password': 'Sembunyikan sandi',
  'Log in': 'Masuk',
  'Our little universe.': 'Semesta kecil kita.',
  'Enter Mikrokosmos ✨': 'Masuk Mikrokosmos ✨',
  'Offline preview — sign in as namnamxyi, kyraawr or xcjessyx with any password.':
    'Pratinjau offline — masuk sebagai namnamxyi, kyraawr, atau xcjessyx dengan kata sandi apa pun.',
  'A little universe shared by three best friends 💫':
    'Semesta kecil yang dibagi tiga sahabat 💫',

  // ── Tabs & navigation ─────────────────────────────────────────
  'Settings': 'Pengaturan',
  'History': 'Riwayat',

  // ── Greetings & day phases ───────────────────────────────────
  'morning': 'pagi',
  'afternoon': 'sore',
  'evening': 'malam',
  'night': 'malam',

  // ── Moods (moodMeta) ─────────────────────────────────────────
  'Sleepy': 'Mengantuk',
  'Okay': 'Biasa Saja',
  'Good': 'Baik',
  'Amazing': 'Luar Biasa',
  'Not My Day': 'Bukan Hariku',

  // ── Meal types (mealMeta) ─────────────────────────────────────
  'Breakfast': 'Sarapan',
  'Lunch': 'Makan Siang',
  'Dinner': 'Makan Malam',
  'Snack': 'Camilan',

  // ── Trend status (trendStatusMeta) ────────────────────────────
  'Idea': 'Ide',
  'Planned': 'Direncanakan',
  'Doing': 'Sedang Berjalan',

  // ── Performance tiers ─────────────────────────────────────────
  'Cosmic Day': 'Hari Kosmik',
  'Growing': 'Tumbuh',

  // ── Home ───────────────────────────────────────────────────────
  'Waking up your universe…': 'Membangunkan semestamu…',
  'Feeling': 'Merasa',
  'Welcome back to your little universe.': 'Selamat datang kembali di semesta kecilmu.',
  '🌱 A fresh day': '🌱 Hari baru yang segar',
  'Opening your universe…': 'Membuka semestamu…',
  'Our Mikrokosmos Today': 'Mikrokosmos Kita Hari Ini',
  'Recent Activity': 'Aktivitas Terkini',
  'Quiet in the universe so far': 'Semestanya masih tenang',
  'Check in, log a meal or add a trend — it will show up here.':
    'Check-in, catat makanan, atau tambah tren — semua akan muncul di sini.',

  // ── Check-in modal ────────────────────────────────────────────
  'Morning Check-in': 'Check-in Pagi',
  'How did you wake up?': 'Bagaimana caramu bangun?',
  'Wake up': 'Bangun',
  'Skip for now': 'Lewati dulu',

  // ── Self Love ──────────────────────────────────────────────────
  '+ 1 Glass': '+ 1 Gelas',
  '− Remove': '− Hapus',
  'Notes': 'Catatan',

  // ── Add meal modal ─────────────────────────────────────────────
  'Add Meal': 'Tambah Makanan',
  'Edit Meal': 'Ubah Makanan',
  'Meal name': 'Nama makanan',
  'Analyze Photo ✨': 'Analisis Foto ✨',
  'Analyzing…': 'Menganalisis…',
  'Photo analysis unavailable right now. Try typing the food name instead! 🍽️':
    'Analisis foto belum tersedia. Coba ketik nama makanannya! 🍽️',
  'Save changes': 'Simpan perubahan',
  "What's inside": 'Isi di dalamnya',
  'Estimated total': 'Perkiraan total',
  'Meal Details': 'Detail Makanan',
  'Meal logged': 'Makanan tercatat',
  'Meal details not available': 'Detail makanan tidak tersedia',
  'This meal was logged before detailed tracking was enabled.':
    'Makanan ini dicatat sebelum fitur detail diaktifkan.',

  // ── Body metrics ──────────────────────────────────────────────
  'Body': 'Tubuh',
  'Height': 'Tinggi',
  'Weight': 'Berat',
  'Age': 'Usia',
  'Female': 'Perempuan',
  'Male': 'Laki-laki',
  'Daily activity': 'Aktivitas harian',
  'Your goal': 'Tujuanmu',
  'Set up My Body': 'Atur Tubuhku',
  'BMI': 'BMI',
  'kcal/day': 'kcal/hari',
  'TDEE': 'TDEE',
  'Mostly sitting': 'Kebanyakan duduk',
  'Lightly active': 'Sedikit aktif',
  'Active': 'Aktif',
  'Very active': 'Sangat aktif',
  'Athlete level': 'Level atlet',
  'Gentle loss': 'Penurunan lembut',
  'Steady loss': 'Penurunan stabil',
  'Focused loss': 'Penurunan fokus',
  'Maintain': 'Dipertahankan',
  'Estimates are guidance, never judgment ✨': 'Angka ini panduan, bukan penilaian ✨',

  // ── Chat ──────────────────────────────────────────────────────
  'Miko': 'Miko',

  // ── Trends ─────────────────────────────────────────────────────
  'Our Trends ✨': 'Tren Kita ✨',
  'Our Checklist': 'Checklist Kita',
  'Open Link': 'Buka Tautan',
  'You did it! ✨': 'Kamu berhasil! ✨',
  'Status': 'Status',

  // ── Memories ───────────────────────────────────────────────────
  'Memories 💌': 'Kenangan 💌',
  'Add photo': 'Tambah foto',

  // ── Achievements ───────────────────────────────────────────────
  'Achievements 🏅': 'Pencapaian 🏅',

  // ── Calendar ───────────────────────────────────────────────────
  'Activity Calendar 📅': 'Kalender Aktivitas 📅',
  "Nothing was logged this day — and that's okay 💛 rest 🌙":
    'Tidak ada catatan hari itu — dan tidak apa-apa 💛 istirahat 🌙',
  'Day total': 'Total hari',
  'check-in': 'check-in',
  'meals / water / steps': 'makanan / air / langkah',

  // ── Me / profile ───────────────────────────────────────────────
  'Edit Profile': 'Ubah Profil',
  'Display name': 'Nama tampilan',
  'Your emoji': 'Emojimu',
  'Bio (optional)': 'Bio (opsional)',
  'Privacy': 'Privasi',
  'Control what friends can see': 'Atur apa yang teman bisa lihat',
  'Memories': 'Kenangan',
  'Your shared scrapbook': 'Buku kenangan bersama',
  'Achievements': 'Pencapaian',
  'Gentle milestone badges': 'Lencana pencapaian yang lembut',
  'Activity Calendar': 'Kalender Aktivitas',
  'Day-by-day history of your little universe':
    'Riwayat harian semesta kecilmu',
  'Change Password': 'Ubah Kata Sandi',
  'Keep your universe safe': 'Jaga keamanan semestamu',
  'Connect Supabase to enable': 'Hubungkan Supabase untuk mengaktifkan',
  'About Mikrokosmos': 'Tentang Mikrokosmos',
  'Our little universe': 'Semesta kecil kita',
  'Demo mode': 'Mode demo',
  'Password changes need the live Supabase backend.':
    'Perubahan kata sandi butuh backend Supabase aktif.',
  'New password': 'Kata sandi baru',
  'Edit Profile 🎀': 'Ubah Profil 🎀',
  'Privacy 🤍': 'Privasi 🤍',
  'v1.0 · Phase 1 MVP': 'v1.0 · MVP Fase 1',
  'Language': 'Bahasa',
  'Theme': 'Tema',
  'Dark Mode': 'Mode Gelap',
  'Light': 'Terang',
  'Dark': 'Gelap',
  'System default': 'Bawaan sistem',
  'App Language & Theme': 'Bahasa & Tema Aplikasi',
  'Choose your vibe': 'Pilih suasana yang kamu suka',

  // ── Friend profile ─────────────────────────────────────────────
  'You': 'Kamu',

  // ── Mood / meal / status labels (colors.ts) ────────────────────
  'Seedling': 'Tunas',
};

export interface I18nContextValue {
  language: AppLanguage;
  /** Translate. Falls back to the English key when no ID entry exists. */
  t: (key: string) => string;
  setLanguage: (lang: AppLanguage) => void;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  t: (k) => k,
  setLanguage: () => undefined,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  // Restore the saved language on mount (AsyncStorage on native,
  // localStorage on web).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'id' || saved === 'en') setLanguageState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => undefined);
  }, []);

  const t = useCallback(
    (key: string) => (language === 'id' ? ID[key] ?? key : key),
    [language]
  );

  const value = useMemo(
    () => ({ language, t, setLanguage }),
    [language, t, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}









