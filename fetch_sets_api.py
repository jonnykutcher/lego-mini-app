import json
import time
import requests

# ⬇⬇⬇ ВСТАВЬ СЮДА СВОЙ КЛЮЧ В КАВЫЧКАХ ⬇⬇⬇
BRICKSET_API_KEY = "3-B3CP-wp4J-9rw3X"
# ⬆⬆⬆ ТОЛЬКО ЗАМЕНИ СЛОВО КЛЮЧ ⬆⬆⬆

API_BASE = "https://brickset.com/api/v3.asmx"
UA = "Mozilla/5.0 (LEGO-Hold personal app)"

THEMES = ["BrickHeadz", "Marvel Super Heroes"]
PAGE_SIZE = 500
DELAY = 0.3

session = requests.Session()
session.headers.update({"User-Agent": UA})


def call_get_sets(theme: str, page: int):
    params_obj = {
        "theme": theme,
        "pageSize": PAGE_SIZE,
        "pageNumber": page,
        "orderBy": "Number",
        "extendedData": 0
    }

    # ВАЖНО: передаём userHash (пусть будет пустой строкой)
    payload = {
        "apiKey": BRICKSET_API_KEY,
        "userHash": "",
        "params": json.dumps(params_obj)
    }

    r = session.post(
        f"{API_BASE}/getSets",
        data=payload,
        timeout=30
    )
    r.raise_for_status()
    return r.json()


def get_sets_for_theme(theme: str):
    all_sets = []
    page = 1

    while True:
        data = call_get_sets(theme, page)

        if data.get("status") != "success":
            raise RuntimeError(data)

        batch = data.get("sets", []) or []
        all_sets.extend(batch)

        print(f"[{theme}] page {page}: +{len(batch)} (total {len(all_sets)})")

        if len(batch) < PAGE_SIZE:
            break

        page += 1
        time.sleep(DELAY)

    return all_sets


def main():
    if BRICKSET_API_KEY == "КЛЮЧ":
        raise SystemExit("❌ Ты не вставил API ключ")

    result = []
    for theme in THEMES:
        result.extend(get_sets_for_theme(theme))

    # дедуп по setID
    uniq = {}
    for s in result:
        sid = s.get("setID")
        if sid:
            uniq[sid] = s

    with open("sets_raw.json", "w", encoding="utf-8") as f:
        json.dump(list(uniq.values()), f, ensure_ascii=False, indent=2)

    print(f"✅ Готово. Наборов сохранено: {len(uniq)}")


if __name__ == "__main__":
    main()
