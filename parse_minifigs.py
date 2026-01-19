import json
import re
import time
import random
from bs4 import BeautifulSoup
import requests

UA = "Mozilla/5.0 (LEGO-Hold personal app)"

# базовая пауза между наборами (можно 1.0–2.0)
BASE_DELAY = 1.2

# сколько раз пробуем один и тот же набор при ошибках/429
MAX_RETRIES = 6

# Brickset theme -> твоя series
THEME_TO_SERIES = {
    "BrickHeadz": "BrickHeadz",
    "Marvel Super Heroes": "Marvel",
}

session = requests.Session()
session.headers.update({
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
})


def normalize_set_number(set_obj: dict) -> str:
    num = str(set_obj.get("number", "")).strip()
    var = set_obj.get("numberVariant", 1)
    try:
        var = int(var)
    except Exception:
        var = 1
    return f"{num}-{var}" if num else ""


def pick_set_image(set_obj: dict) -> str:
    img = set_obj.get("image") or {}
    if isinstance(img, dict):
        for k in ("imageURL", "imageUrl", "thumbnailURL", "thumbnailUrl"):
            if img.get(k):
                return img.get(k)
    return ""


def abs_url(url: str) -> str:
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://brickset.com" + url
    return url


def fetch_html_with_retry(url: str) -> str:
    """
    Возвращает HTML страницы.
    При 429 делает backoff (ждёт дольше и пробует снова).
    """
    last_err = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = session.get(url, timeout=40)

            # 429 — слишком много запросов
            if r.status_code == 429:
                # иногда сервер присылает Retry-After (секунды)
                retry_after = r.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    wait_s = int(retry_after)
                else:
                    # экспоненциальная пауза: 10, 20, 40, 80... + небольшой рандом
                    wait_s = min(180, (2 ** (attempt + 2)) * 2)  # capped
                wait_s += random.uniform(0.5, 2.0)

                print(f"429 for {url} — waiting {wait_s:.1f}s (attempt {attempt}/{MAX_RETRIES})")
                time.sleep(wait_s)
                continue

            r.raise_for_status()
            return r.text

        except requests.RequestException as e:
            last_err = e
            # мягкий backoff на сетевые ошибки
            wait_s = min(60, 3 * attempt) + random.uniform(0.3, 1.2)
            print(f"Request error for {url}: {e} — waiting {wait_s:.1f}s")
            time.sleep(wait_s)

    raise last_err if last_err else RuntimeError("Failed to fetch HTML")


def parse_minifigs_from_set_page(url: str):
    """
    Ищем ссылки на /minifigs/<id>
    и вытаскиваем id, name, image (если есть).
    """
    if not url:
        return []

    html = fetch_html_with_retry(url)
    soup = BeautifulSoup(html, "html.parser")

    figs = []

    for a in soup.select('a[href*="/minifigs/"]'):
        href = a.get("href", "")
        m = re.search(r"/minifigs/([A-Za-z0-9_-]+)", href)
        if not m:
            continue

        fig_id = m.group(1).strip()
        name = a.get_text(" ", strip=True) or fig_id

        img_url = ""
        img = a.find("img")
        if img and img.get("src"):
            img_url = abs_url(img.get("src"))

        figs.append({"id": fig_id, "name": name, "image": img_url})

    # дедуп
    uniq = {}
    for f in figs:
        uniq[f["id"]] = f

    return list(uniq.values())


def main():
    with open("sets_raw.json", "r", encoding="utf-8") as f:
        raw = json.load(f)

    cache_path = "minifigs_cache.json"
    try:
        with open(cache_path, "r", encoding="utf-8") as f:
            cache = json.load(f)
    except Exception:
        cache = {}

    out = []
    total = len(raw)

    for i, set_obj in enumerate(raw, start=1):
        theme = str(set_obj.get("theme", "")).strip()
        series = THEME_TO_SERIES.get(theme, theme or "Unknown")

        set_id = normalize_set_number(set_obj)
        name = str(set_obj.get("name", "")).strip()
        image = pick_set_image(set_obj)
        url = str(set_obj.get("bricksetURL", "")).strip()

        if not set_id:
            continue

        if set_id in cache:
            minifigs = cache[set_id]
        else:
            try:
                minifigs = parse_minifigs_from_set_page(url)
            except Exception as e:
                print(f"[{i}/{total}] {set_id} ERROR: {e}")
                minifigs = []

            cache[set_id] = minifigs
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)

            # базовая пауза между наборами + небольшой jitter
            time.sleep(BASE_DELAY + random.uniform(0.1, 0.6))

        out.append({
            "id": set_id,
            "series": series,
            "name": name,
            "image": image,
            "minifigs": minifigs
        })

        if i % 25 == 0:
            print(f"Progress: {i}/{total}")

    with open("sets_full.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"✅ Done. Wrote {len(out)} sets to sets_full.json")


if __name__ == "__main__":
    main()
