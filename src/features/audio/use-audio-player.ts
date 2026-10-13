/**
 * متحكّم تشغيل التلاوة (المرحلة 6) — يربط expo-audio بمستودعات التطبيق.
 *
 * القرارات:
 * - المصدر: الملف المحلي إن كان مُنزَّلًا، وإلا البث المباشر من الـ CDN (يعمل بلا تنزيل).
 * - حفظ الموضع: كل 5 ثوانٍ أثناء التشغيل + عند الإيقاف/التبديل/مغادرة الشاشة
 *   (حفظ خفيف في Realm عبر مستودع تقدّم الاستماع).
 * - الانتقال التلقائي للآية التالية عند انتهاء الملف في نمط «آية بآية».
 * - التكرار: بلا / تكرار الآية / تكرار السورة — من إعدادات المستخدم المحفوظة.
 *
 * ملاحظة: يعتمد على `useAudioPlayer` من expo-audio — لا يُستورد في اختبارات Node.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { getAudioProgressRepository } from '../../repositories/audio-progress-repository';
import { getGlobalAyahNumber } from '../../repositories/quran-content-repository';
import { audioFileOf, playbackSource } from './audio-downloader';
import type { AudioMode, AudioRepeatMode } from '../../database/realm/types';

export interface AudioTrackRef {
  reciterId: string;
  mode: AudioMode;
  /** رقم السورة في نمط `surah` — أو السورة الحاوية في نمط `ayah` */
  surahNumber: number;
  /** رقم الآية العالمي (1..6236) في نمط `ayah`، أو 1 في نمط `surah` */
  ayahGlobal: number;
  /** ترتيب الآية داخل السورة (1..n) */
  ayahInSurah: number;
  bitrate: string;
}

export interface AudioController {
  isPlaying: boolean;
  isBuffering: boolean;
  /** الموضع الحالي بالثواني */
  positionSec: number;
  /** المدة بالثواني (0 إن لم تُحمّل) */
  durationSec: number;
  /** هل المشغّل يعمل من ملف محلي (لا شبكة) */
  isOffline: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => Promise<void>;
  skip: (deltaSec: number) => Promise<void>;
  setRate: (rate: number) => void;
  rate: number;
  repeat: AudioRepeatMode;
  setRepeat: (mode: AudioRepeatMode) => void;
  /** انتقل إلى آية/سورة أخرى (يحفظ موضع الحالي أولًا) */
  goTo: (next: AudioTrackRef) => void;
  hasNext: boolean;
  hasPrev: boolean;
  next: () => void;
  prev: () => void;
}

const SAVE_INTERVAL_MS = 5000;

export function useAudioController(initial: AudioTrackRef, ayahCountOfSurah: (surah: number) => number) {
  const [track, setTrack] = useState<AudioTrackRef>(initial);
  const [rate, setRateState] = useState<number>(1.0);
  const [repeat, setRepeatState] = useState<AudioRepeatMode>('off');

  const source = useMemo(() => playbackSource(track.reciterId, track.mode, track.mode === 'surah' ? track.surahNumber : track.ayahGlobal, track.bitrate), [track]);
  const player = useAudioPlayer(source, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const lastSaveRef = useRef<number>(0);
  const endedRef = useRef<boolean>(false);

  // إعداد جلسة الصوت مرة واحدة (تشغيل في الخلفية + في وضع الصمت)
  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {
      /* لا يمنع التشغيل — تُعرض الحالة كما هي */
    });
  }, []);

  const save = useCallback(
    (positionSec: number, ayahInSurah?: number) => {
      getAudioProgressRepository().save(
        track.reciterId,
        track.surahNumber,
        ayahInSurah ?? track.ayahInSurah,
        Math.round(positionSec * 1000),
      );
      lastSaveRef.current = Date.now();
    },
    [track],
  );

  // حفظ دوري أثناء التشغيل
  useEffect(() => {
    if (!status.playing) return;
    if (Date.now() - lastSaveRef.current < SAVE_INTERVAL_MS) return;
    save(status.currentTime);
  }, [status.currentTime, status.playing, save]);

  // حفظ عند التوقف/مغادرة الشاشة
  useEffect(() => {
    return () => {
      if (player && typeof player.currentTime === 'number') {
        try {
          save(player.currentTime);
        } catch {
          /* القاعدة مقفلة — لا نُسقط الشاشة */
        }
      }
    };
  }, [player, save]);

  // تكرار الآية
  useEffect(() => {
    player.loop = repeat === 'ayah';
  }, [player, repeat]);

  // سرعة التشغيل
  useEffect(() => {
    try {
      player.setPlaybackRate(rate, 'high');
    } catch {
      player.playbackRate = rate;
    }
  }, [player, rate]);

  // الانتقال التلقائي عند انتهاء الملف
  useEffect(() => {
    const finished =
      status.duration > 0 && !status.playing && status.currentTime >= status.duration - 0.4;
    if (!finished || endedRef.current) return;
    endedRef.current = true;
    save(status.duration, track.ayahInSurah);

    if (repeat === 'surah' && track.mode === 'surah') {
      void player.seekTo(0).then(() => player.play());
      return;
    }
    if (track.mode === 'ayah') {
      const count = ayahCountOfSurah(track.surahNumber);
      if (track.ayahInSurah < count) {
        const nextGlobal = getGlobalAyahNumber(track.surahNumber, track.ayahInSurah + 1);
        setTrack((t) => ({ ...t, ayahGlobal: nextGlobal, ayahInSurah: t.ayahInSurah + 1 }));
      } else {
        getAudioProgressRepository().markCompleted(track.reciterId, track.surahNumber);
      }
    } else {
      getAudioProgressRepository().markCompleted(track.reciterId, track.surahNumber);
    }
    setTimeout(() => {
      endedRef.current = false;
    }, 800);
  }, [status.duration, status.playing, status.currentTime, repeat, track, player, save, ayahCountOfSurah]);

  const goTo = useCallback(
    (next: AudioTrackRef) => {
      save(player.currentTime || 0);
      setTrack(next);
    },
    [player, save],
  );

  const hasNext = track.mode === 'surah' ? track.surahNumber < 114 : track.ayahInSurah < ayahCountOfSurah(track.surahNumber);
  const hasPrev = track.mode === 'surah' ? track.surahNumber > 1 : track.ayahInSurah > 1;

  const next = useCallback(() => {
    if (!hasNext) return;
    if (track.mode === 'surah') {
      setTrack((t) => ({ ...t, surahNumber: t.surahNumber + 1 }));
    } else {
      const nextGlobal = getGlobalAyahNumber(track.surahNumber, track.ayahInSurah + 1);
      setTrack((t) => ({ ...t, ayahGlobal: nextGlobal, ayahInSurah: t.ayahInSurah + 1 }));
    }
  }, [hasNext, track]);

  const prev = useCallback(() => {
    if (!hasPrev) return;
    if (track.mode === 'surah') {
      setTrack((t) => ({ ...t, surahNumber: t.surahNumber - 1 }));
    } else {
      const nextGlobal = getGlobalAyahNumber(track.surahNumber, track.ayahInSurah - 1);
      setTrack((t) => ({ ...t, ayahGlobal: nextGlobal, ayahInSurah: t.ayahInSurah - 1 }));
    }
  }, [hasPrev, track]);

  const controller: AudioController = {
    isPlaying: !!status.playing,
    isBuffering: !!status.isBuffering,
    positionSec: status.currentTime || 0,
    durationSec: status.duration || 0,
    isOffline: audioFileOf(
      track.reciterId,
      track.mode,
      track.mode === 'surah' ? track.surahNumber : track.ayahGlobal,
    ).exists,
    play: () => player.play(),
    pause: () => {
      save(player.currentTime || 0);
      player.pause();
    },
    toggle: () => {
      if (player.playing) {
        save(player.currentTime || 0);
        player.pause();
      } else {
        player.play();
      }
    },
    seek: (seconds: number) => player.seekTo(Math.max(0, seconds)),
    skip: (deltaSec: number) => player.seekTo(Math.max(0, (player.currentTime || 0) + deltaSec)),
    setRate: (r: number) => setRateState(r),
    rate,
    repeat,
    setRepeat: (m: AudioRepeatMode) => setRepeatState(m),
    goTo,
    hasNext,
    hasPrev,
    next,
    prev,
  };

  return { track, controller };
}

/** تنسيق الثواني إلى دقيقة:ثانية بالأرقام العربية */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  return `${ar(m)}:${ar(rem).padStart(2, '٠')}`;
}
