"""
تطبيق تحفيظ القرآن الكريم وتصحيح التلاوة
Quran Memorization & Recitation Correction App
Backend Server - Flask
"""

import os
import re
import difflib
import tempfile
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─── App Init ─────────────────────────────────────────────────────────────────
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25 MB max upload

# ─── Quran Data ───────────────────────────────────────────────────────────────
# سورة الفاتحة كاملة مع البيانات الوصفية
SURAHS = {
    1: {
        "name": "الفاتحة",
        "name_en": "Al-Fatiha",
        "ayahs": [
            {"number": 1, "text": "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"},
            {"number": 2, "text": "ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ"},
            {"number": 3, "text": "ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"},
            {"number": 4, "text": "مَٰلِكِ يَوۡمِ ٱلدِّينِ"},
            {"number": 5, "text": "إِيَّاكَ نَعۡبُدُ وَإِيَّاكَ نَسۡتَعِينُ"},
            {"number": 6, "text": "ٱهۡدِنَا ٱلصِّرَٰطَ ٱلۡمُسۡتَقِيمَ"},
            {"number": 7, "text": "صِرَٰطَ ٱلَّذِينَ أَنۡعَمۡتَ عَلَيۡهِمۡ غَيۡرِ ٱلۡمَغۡضُوبِ عَلَيۡهِمۡ وَلَا ٱلضَّآلِّينَ"},
        ]
    },
    2: {
        "name": "البقرة",
        "name_en": "Al-Baqarah",
        "ayahs": [
            {"number": 1,  "text": "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"},
            {"number": 2,  "text": "الٓمٓ"},
            {"number": 3,  "text": "ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ هُدٗى لِّلۡمُتَّقِينَ"},
            {"number": 4,  "text": "ٱلَّذِينَ يُؤۡمِنُونَ بِٱلۡغَيۡبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقۡنَٰهُمۡ يُنفِقُونَ"},
            {"number": 5,  "text": "وَٱلَّذِينَ يُؤۡمِنُونَ بِمَآ أُنزِلَ إِلَيۡكَ وَمَآ أُنزِلَ مِن قَبۡلِكَ وَبِٱلۡأٓخِرَةِ هُمۡ يُوقِنُونَ"},
        ]
    },
    112: {
        "name": "الإخلاص",
        "name_en": "Al-Ikhlas",
        "ayahs": [
            {"number": 1, "text": "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"},
            {"number": 2, "text": "قُلۡ هُوَ ٱللَّهُ أَحَدٌ"},
            {"number": 3, "text": "ٱللَّهُ ٱلصَّمَدُ"},
            {"number": 4, "text": "لَمۡ يَلِدۡ وَلَمۡ يُولَدۡ"},
            {"number": 5, "text": "وَلَمۡ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ"},
        ]
    },
    113: {
        "name": "الفلق",
        "name_en": "Al-Falaq",
        "ayahs": [
            {"number": 1, "text": "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"},
            {"number": 2, "text": "قُلۡ أَعُوذُ بِرَبِّ ٱلۡفَلَقِ"},
            {"number": 3, "text": "مِن شَرِّ مَا خَلَقَ"},
            {"number": 4, "text": "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ"},
            {"number": 5, "text": "وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِي ٱلۡعُقَدِ"},
            {"number": 6, "text": "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ"},
        ]
    },
    114: {
        "name": "الناس",
        "name_en": "An-Nas",
        "ayahs": [
            {"number": 1, "text": "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ"},
            {"number": 2, "text": "قُلۡ أَعُوذُ بِرَبِّ ٱلنَّاسِ"},
            {"number": 3, "text": "مَلِكِ ٱلنَّاسِ"},
            {"number": 4, "text": "إِلَٰهِ ٱلنَّاسِ"},
            {"number": 5, "text": "مِن شَرِّ ٱلۡوَسۡوَاسِ ٱلۡخَنَّاسِ"},
            {"number": 6, "text": "ٱلَّذِي يُوَسۡوِسُ فِي صُدُورِ ٱلنَّاسِ"},
            {"number": 7, "text": "مِنَ ٱلۡجِنَّةِ وَٱلنَّاسِ"},
        ]
    },
}

# ─── Text Normalization ───────────────────────────────────────────────────────

# Unicode ranges for Arabic diacritics (Tashkeel)
TASHKEEL = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]')

# Map various Alef forms to plain Alef
ALEF_NORMALIZE = str.maketrans({
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٳ': 'ا',
    'ة': 'ه',  # Ta' Marbuta → Ha
    'ى': 'ي',  # Alef Maqsura → Ya
    'ؤ': 'و',  # Waw Hamza → Waw
    'ئ': 'ي',  # Ya Hamza → Ya
})

PUNCTUATION = re.compile(r'[،؟!.,؛:«»\-\s]+')


def normalize_arabic(text: str) -> str:
    """
    تطبيع النص العربي لأغراض المقارنة:
    1. إزالة التشكيل (حركات، سكون، شدة ...)
    2. توحيد صور الألف والحروف المتعددة
    3. إزالة علامات الترقيم والمسافات الزائدة
    """
    text = TASHKEEL.sub('', text)
    text = text.translate(ALEF_NORMALIZE)
    text = PUNCTUATION.sub(' ', text)
    return text.strip()


# ─── Comparison Logic ─────────────────────────────────────────────────────────

def compare_texts(original: str, recited: str) -> dict:
    """
    مقارنة ذكية بين نص الآية الأصلية والنص المتلوّ.
    تُعيد نسبة التطابق وقائمة بالكلمات الخاطئة.
    """
    orig_clean   = normalize_arabic(original).split()
    recit_clean  = normalize_arabic(recited).split()
    orig_words   = original.split()

    # SequenceMatcher يعطي نسبة تطابق سلسة (Levenshtein-like)
    matcher = difflib.SequenceMatcher(
        None,
        ' '.join(orig_clean),
        ' '.join(recit_clean),
        autojunk=False
    )
    ratio = matcher.ratio()

    # تمييز الكلمات الصحيحة والخاطئة على مستوى الكلمة
    word_results = []
    sm = difflib.SequenceMatcher(None, orig_clean, recit_clean, autojunk=False)
    matched_indices = set()
    for block in sm.get_matching_blocks():
        for i in range(block.size):
            matched_indices.add(block.a + i)

    for i, word in enumerate(orig_words):
        clean_word = normalize_arabic(word)
        if not clean_word:
            word_results.append({"word": word, "correct": True})
            continue
        # نطابق الكلمة مع نظيرتها في الكلمات النظيفة الأصلية
        idx_in_clean = len([normalize_arabic(w) for w in orig_words[:i] if normalize_arabic(w)])
        is_correct = idx_in_clean in matched_indices
        word_results.append({"word": word, "correct": is_correct})

    return {
        "ratio":        round(ratio, 4),
        "percentage":   round(ratio * 100, 1),
        "passed":       ratio >= 0.85,
        "word_results": word_results,
    }


# ─── Speech Recognition ───────────────────────────────────────────────────────

def transcribe_audio(audio_path: str) -> str:
    """
    تحويل الصوت إلى نص. تحاول استخدام Whisper أولاً، ثم SpeechRecognition.
    """
    # محاولة 1: OpenAI Whisper (محلي، دقيق، يدعم العربية بشكل ممتاز)
    try:
        import whisper
        logger.info("Using OpenAI Whisper for transcription …")
        model = whisper.load_model("small")          # small أسرع، large أدق
        result = model.transcribe(audio_path, language="ar", fp16=False)
        text = result.get("text", "").strip()
        logger.info(f"Whisper result: {text}")
        if text:
            return text
    except ImportError:
        logger.warning("Whisper not installed. Trying SpeechRecognition …")
    except Exception as e:
        logger.error(f"Whisper error: {e}")

    # محاولة 2: Google Speech-to-Text عبر SpeechRecognition
    try:
        import speech_recognition as sr
        logger.info("Using Google Speech Recognition …")
        recognizer = sr.Recognizer()
        with sr.AudioFile(audio_path) as source:
            audio_data = recognizer.record(source)
        text = recognizer.recognize_google(audio_data, language="ar-SA")
        logger.info(f"Google STT result: {text}")
        return text
    except ImportError:
        logger.warning("SpeechRecognition not installed.")
    except sr.UnknownValueError:
        logger.warning("Google STT could not understand audio.")
    except Exception as e:
        logger.error(f"Google STT error: {e}")

    return ""


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """الصفحة الرئيسية"""
    surah_list = [
        {"number": k, "name": v["name"], "ayah_count": len(v["ayahs"])}
        for k, v in SURAHS.items()
    ]
    return render_template('index.html', surah_list=surah_list)


@app.route('/api/surah/<int:surah_number>')
def get_surah(surah_number: int):
    """إرجاع بيانات السورة"""
    if surah_number not in SURAHS:
        return jsonify({"error": "السورة غير موجودة"}), 404
    return jsonify(SURAHS[surah_number])


@app.route('/api/audio/<int:surah_number>/<int:ayah_number>')
def get_audio_url(surah_number: int, ayah_number: int):
    """
    إرجاع رابط تلاوة الشيخ المنشاوي من API مجانية (EveryAyah).
    صيغة الرابط: https://everyayah.com/data/{القارئ}/{رقم_السورة_3خانات}{رقم_الآية_3خانات}.mp3
    """
    reciter = "Minshawi_Murattal_128kbps"   # الشيخ المنشاوي - المرتل
    s = str(surah_number).zfill(3)
    a = str(ayah_number).zfill(3)
    url = f"https://everyayah.com/data/{reciter}/{s}{a}.mp3"
    return jsonify({"url": url, "reciter": "الشيخ محمد صديق المنشاوي"})


@app.route('/process_audio', methods=['POST'])
def process_audio():
    """
    المسار الرئيسي لمعالجة الصوت المسجّل:
    1. استلام الملف الصوتي
    2. تحويله إلى نص (ASR)
    3. مقارنته بنص الآية
    4. إرجاع النتيجة
    """
    if 'audio' not in request.files:
        return jsonify({"error": "لم يُرسَل ملف صوتي"}), 400

    ayah_text = request.form.get('ayah_text', '')
    if not ayah_text:
        return jsonify({"error": "نص الآية مفقود"}), 400

    audio_file = request.files['audio']
    logger.info(f"Received audio: {audio_file.filename}, mimetype: {audio_file.mimetype}")

    # حفظ الملف مؤقتاً
    suffix = '.webm'
    if audio_file.filename and '.' in audio_file.filename:
        suffix = '.' + audio_file.filename.rsplit('.', 1)[-1]

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # إذا كان الملف مرسلاً بصيغة WAV جاهزة، نستخدمه مباشرة دون الحاجة لـ pydub/ffmpeg
        wav_path = tmp_path
        if not suffix.lower().endswith('.wav'):
            try:
                from pydub import AudioSegment
                audio = AudioSegment.from_file(tmp_path)
                wav_path = tmp_path.replace(suffix, '.wav')
                audio.export(wav_path, format='wav')
                logger.info(f"Converted to WAV: {wav_path}")
            except Exception as e:
                logger.warning(f"pydub conversion skipped: {e} — using original file")

        # التعرف على الكلام
        transcribed = transcribe_audio(wav_path)
        logger.info(f"Transcribed text: '{transcribed}'")

        if not transcribed:
            return jsonify({
                "success": False,
                "transcribed": "",
                "message": "لم نتمكن من فهم الصوت. تأكد من وضوح التلاوة والميكروفون.",
                "word_results": [],
                "percentage": 0,
            })

        # المقارنة
        result = compare_texts(ayah_text, transcribed)
        logger.info(f"Comparison result: ratio={result['ratio']}, passed={result['passed']}")

        return jsonify({
            "success": True,
            "transcribed": transcribed,
            "passed":      result["passed"],
            "percentage":  result["percentage"],
            "word_results": result["word_results"],
            "message": "أحسنت! تلاوة صحيحة ✓" if result["passed"] else f"نسبة التطابق {result['percentage']}% — حاول مرة أخرى",
        })

    except Exception as e:
        logger.error(f"Error processing audio: {e}", exc_info=True)
        return jsonify({"error": f"خطأ في المعالجة: {str(e)}"}), 500

    finally:
        # حذف الملفات المؤقتة
        for path in [tmp_path, wav_path if 'wav_path' in locals() else None]:
            if path and os.path.exists(path) and path != tmp_path:
                try:
                    os.unlink(path)
                except Exception:
                    pass
        if os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    logger.info("🕌 تطبيق تحفيظ القرآن الكريم يعمل على http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
