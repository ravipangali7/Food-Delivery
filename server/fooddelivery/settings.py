from pathlib import Path
import os

# Shyam's Sweets — मुख्य सेटिङ फाइल (production: DEBUG=0, SECRET_KEY env बाट)।
BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-6t@ddb=in!t=d)7)=*o+pxpk52jo%zt&lo$ivg6k8io7z=yevh",
)

# उत्पादनमा DEBUG=0 सेट गर्नुहोस् (cPanel env)। DEBUG=1 हुँदा OTP कोड API JSON मा देखिन सक्छ।
DEBUG = os.environ.get("DEBUG", "0").lower() in ("1", "true", "yes")

_allowed = os.environ.get("ALLOWED_HOSTS", "*").strip()
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(",") if h.strip()] or ["*"]

# सार्वजनिक origin — media/file URL को लागि (अन्त्यमा / नराख्ने), उदाहरण: https://api.shyam-sweets.com
# उत्पादनमा reverse proxy पछाडि Django चल्दा uploads र API response मा 127.0.0.1 नआओस् भनेर सेट गर्नुहोस्।
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://api.shyam-sweets.com").strip().rstrip("/")

# nginx/Caddy बाट X-Forwarded-Host प्राथमिकता — PUBLIC_BASE_URL नसेट भएमा request.get_host() सार्वजनिक hostname सँग मिलोस्।
USE_X_FORWARDED_HOST = os.environ.get("USE_X_FORWARDED_HOST", "1").lower() not in ("0", "false", "no")

# cross-origin POST का लागि आवश्यक (उदाहरण: SPA :8080 → API :8000) जब CSRF ले Origin जाँच गर्छ।
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://api.shyam-sweets.com",
    "https://api.shyam-sweets.com",
    "http://shyam-sweets.com",
    "https://shyam-sweets.com",
    "http://www.shyam-sweets.com",
    "https://www.shyam-sweets.com",
]


# एप्लिकेसन परिभाषा

INSTALLED_APPS = [
    'daphne',
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'core',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'channels',
]

AUTH_USER_MODEL = 'core.User'

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'core.middleware.security_headers.SecurityHeadersMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# सत्र र CSRF कुकी — पूर्वनिर्धारित framework नाम बाहिरी प्रयोगकर्तालाई देखिँदैन।
SESSION_COOKIE_NAME = "ss_sid"
CSRF_COOKIE_NAME = "ss_xsrf"
CSRF_HEADER_NAME = "HTTP_X_SS_XSRF"

# API: टोकन प्रमाणीकरण; JSON मात्र (browsable HTML UI बन्द राख्छ)।
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'EXCEPTION_HANDLER': 'core.exceptions.api_exception_handler',
    # admin views ?format=flat|tree — default "format" ले Http404 उठाउँछ।
    'URL_FORMAT_OVERRIDE': 'api_format',
}
# cross-origin SPA → API (फरक subdomain)। ब्राउजरले Authorization / JSON का लागि OPTIONS preflight पठाउँछ;
# response मा Access-Control-Allow-Origin हुनुपर्छ।
# cPanel/Apache कहिलेकाहीँ Django अघि OPTIONS जवाफ दिन्छ — deploy/cpanel-api-subdomain.htaccess.example हेर्नुहोस्।
_default_cors_origins = [
    "https://shyam-sweets.com",
    "https://www.shyam-sweets.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]
_extra_cors = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys([*_default_cors_origins, *_extra_cors]))
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://([\w-]+\.)?shyam-sweets\.com$",
]
# स्थानीय परीक्षणका लागि env मा CORS_ALLOW_ALL_ORIGINS=1; उत्पादनमा CORS_ALLOWED_ORIGINS प्रयोग गर्नुहोस्।
CORS_ALLOW_ALL_ORIGINS = os.environ.get("CORS_ALLOW_ALL_ORIGINS", "").lower() in ("1", "true", "yes")
CORS_PREFLIGHT_MAX_AGE = 86400
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-ss-xsrf",
    "x-requested-with",
]

# Infelo Group — एउटै account API key: SMS, embed, maps-js-key (Infelo API मा Bearer; infelo-api-general.md हेर्नुहोस्)।
INFELO_API_KEY = "inf_5QY67HLrP900FQV7uTv_MsInUnoQbStT"
INFELO_SMS_API_KEY = INFELO_API_KEY
INFELO_SMS_API_HOST = "api.infelogroup.com"
INFELO_SMS_API_BASE = "https://api.infelogroup.com/api"
INFELO_PORTAL_ORIGIN = "https://infelogroup.com"

# Firebase Cloud Messaging — legacy HTTP API server key (Project settings → Cloud Messaging)।
FCM_SERVER_KEY = os.environ.get("FCM_SERVER_KEY", "")
# true भए push मात्र log गर्छ (HTTP call छैन); key बिना स्थानीय परीक्षणका लागि उपयोगी।
FCM_DISABLE_SEND = os.environ.get("FCM_DISABLE_SEND", "").lower() in ("1", "true", "yes")

ROOT_URLCONF = 'fooddelivery.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'core' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'fooddelivery.wsgi.application'
ASGI_APPLICATION = 'fooddelivery.asgi.application'

_redis_url = os.environ.get("REDIS_URL", "").strip()
if _redis_url:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_redis_url]},
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }

# वैकल्पिक: प्राप्तकर्ता offline हुँदा SMS/email का लागि log-only hook (`core.chat_utils`)।
CHAT_OFFLINE_NOTIFY = os.environ.get("CHAT_OFFLINE_NOTIFY", "").lower() in ("1", "true", "yes")
# ``INFELO_SMS_API_KEY`` सेट भएमा staff chat जवाफ Infelo बाट SMS मा पनि पठाउँछ (0/false ले बन्द)।
CHAT_REPLY_SMS = os.environ.get("CHAT_REPLY_SMS", "1").lower() not in ("0", "false", "no")

# server-side Directions API (वैकल्पिक; नसेट वा असफल भए सिधा रेखाको polyline प्रयोग)।
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')


# डाटाबेस
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# पासवर्ड प्रमाणीकरण
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# अन्तर्राष्ट्रियीकरण
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# static फाइलहरू (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'
STATICFILES_DIRS = [
   os.path.join(BASE_DIR, 'static')
] 
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles') 

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# स्टाफ टेम्प्लेट प्यानल — सत्र लगइन (SPA admin भन्दा छुट्टै)।
LOGIN_URL = '/admin/login/'
LOGIN_REDIRECT_URL = '/admin/products/'
LOGOUT_REDIRECT_URL = '/admin/login/'

# Jazzmin सुपरयुजर कन्सोल — root मा नराखी obscure path मा (urls.py मा mount)।
ADMIN_URL = os.environ.get("ADMIN_URL", "ss-internal-cp").strip().strip("/")

# ब्रान्डेड error page — framework traceback बाहिरी प्रयोगकर्तालाई देखिँदैन।
handler400 = "core.views.errors.error_400"
handler403 = "core.views.errors.error_403"
handler404 = "core.views.errors.error_404"
handler500 = "core.views.errors.error_500"

# Jazzmin (django-jazzmin) — admin थिम
JAZZMIN_SETTINGS = {
    'site_title': "Shyam's Admin",
    'site_header': "Shyam's",
    'site_brand': "Shyam's",
    'site_logo': 'brand/logo.png',
    'site_icon': 'brand/logo.png',
    'welcome_sign': 'Food delivery control panel',
    'copyright': "Shyam's",
    'custom_css': 'brand/jazzmin.css',
    'search_model': ['core.User', 'core.Order', 'core.Product', 'core.OTPVerification'],
    'topmenu_links': [
        {'name': 'Dashboard', 'url': 'admin:index', 'permissions': ['auth.view_user']},
        {
            'name': 'OTP Verification',
            'url': 'admin:core_otpverification_changelist',
            'permissions': ['core.view_otpverification'],
        },
    ],
    'icons': {
        'core.User': 'fas fa-user',
        'core.OTPVerification': 'fas fa-shield-alt',
        'core.Order': 'fas fa-shopping-bag',
        'core.Product': 'fas fa-utensils',
        'core.ParentCategory': 'fas fa-folder-open',
        'core.Category': 'fas fa-tag',
        'core.Cart': 'fas fa-shopping-cart',
        'core.Notification': 'fas fa-bell',
        'core.SuperSetting': 'fas fa-cog',
    },
    'order_with_respect_to': [
        'core.SuperSetting',
        'core.User',
        'core.OTPVerification',
        'core.ParentCategory',
        'core.Category',
        'core.Product',
        'core.Cart',
        'core.Order',
        'core.Notification',
    ],
}

JAZZMIN_UI_TWEAKS = {
    'theme': 'default',
    'dark_mode_theme': 'darkly',
    'navbar': 'navbar-danger',
    'sidebar': 'sidebar-dark-danger',
    'accent': 'accent-warning',
    'brand_colour': 'navbar-danger',
    'footer_fixed': False,
}

# उत्पादन सुरक्षा कडा बनाउने — DEBUG=0 हुँदा सक्रिय
if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = os.environ.get(
        "SECURE_SSL_REDIRECT",
        "0" if DEBUG else "1",
    ).lower() in ("1", "true", "yes")
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "").lower() in ("1", "true", "yes")