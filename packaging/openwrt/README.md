# OpenEventor web on OpenWRT

Runs the full OpenEventor web application (UI + API + SQLite) **inside an
OpenWRT router**, next to the [OpenEventor Hub](../../../hub/) utility. The
router becomes a self-contained timing server: the hub talks to the readers,
the web app stores events and serves results — no laptop required on site.

```
readers (RFID / e-punch)
      │  TCP
┌─────▼──────────────────────── router ─┐
│  oe-hub (:8080)  ←pull─  openeventor-web (:8081)  │
└───────────────────────────────────────┘
                        ▲ browser: http://192.168.8.1:8081
```

## 1. Build the packages

```sh
./packaging/openwrt/build-ipk.sh      # → dist/openwrt/*.ipk  (needs Go + npm)
```

| Package | CPU / typical routers |
|---|---|
| `..._arm64.ipk`  | aarch64 — GL-MT3000 (Beryl AX) & most new ARM routers |
| `..._armv7.ipk`  | 32-bit ARM — ipq40xx, sunxi |
| `..._x86_64.ipk` | x86-64 — x86 OpenWRT / VM / PC Engines |

No MIPS packages: the pure-Go SQLite driver doesn't support 32-bit MIPS, and
16 MB-flash MIPS routers (e.g. GL-MT300N-V2 "Mango") are too small for this
binary anyway. On those, run only the hub and host the web app elsewhere.

Not sure which arch? On the router: `opkg print-architecture`.

## 2. Install

**LuCI web UI:** System → Software → **Upload Package…** → the `.ipk` → Install.

**Or over SSH:**
```sh
scp dist/openwrt/openeventor-web_0.1.0_arm64.ipk root@192.168.8.1:/tmp/
ssh root@192.168.8.1 'opkg install /tmp/openeventor-web_0.1.0_arm64.ipk'
# opkg too strict about the arch string? The binary is still correct:
#   opkg install --force-architecture /tmp/openeventor-web_0.1.0_arm64.ipk
```
The service starts immediately and on every boot.

## 3. Use

- Open `http://<router-ip>:8081` — the OpenEventor UI.
- Timing systems → Add → **OpenEventor HUB** → address `127.0.0.1:8080`
  (the hub on the same router), pick the receiving event, make it active.
- Check: `logread -e openeventor-web`, `/etc/init.d/openeventor-web status`.

## 4. Configure (optional)

`/etc/config/openeventor-web` (preserved across upgrades):
```
config openeventor-web 'main'
	option port  '8081'
	option data  '/usr/share/openeventor-web'
```
then `/etc/init.d/openeventor-web restart`. Event `.db` files live under
`data` — point it at USB/SD storage for heavy use to spare the router's flash.

There is no login: OpenEventor is auth-free by design — the router's LAN is
the trust boundary. Anyone on the event Wi-Fi can open the UI.

## 5. Uninstall

```sh
opkg remove openeventor-web    # event data in /usr/share/openeventor-web stays
```
