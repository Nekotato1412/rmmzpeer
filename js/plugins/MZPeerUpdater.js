/*:
 * @target MZ
 * @plugindesc Checks GitHub Releases for a newer MZPeer.js and installs it.
 * @author Best Waifu
 *
 * @param Repository
 * @desc GitHub repository as owner/name.
 * @type text
 * @default YourName/YourRepo
 *
 * @param Asset Name
 * @desc File name of the plugin attached to each release.
 * @type text
 * @default MZPeer.js
 *
 * @param Installed Plugin File
 * @desc File inside js/plugins to replace.
 * @type text
 * @default MZPeer.js
 *
 * @help
 * Publish a GitHub Release whose tag is a version (e.g. v1.2.0) and attach the
 * plugin file as an asset. On the title screen the game checks the latest
 * release and offers to install it. Only runs in a release build.
 */
var BestWaifu = BestWaifu || {};
BestWaifu.MZPeerUpdater = BestWaifu.MZPeerUpdater || {};

BestWaifu.MZPeerUpdater.params = PluginManager.parameters("MZPeerUpdater");
BestWaifu.MZPeerUpdater.REPO = String(BestWaifu.MZPeerUpdater.params["Repository"] || "");
BestWaifu.MZPeerUpdater.ASSET = String(BestWaifu.MZPeerUpdater.params["Asset Name"] || "MZPeer.js");
BestWaifu.MZPeerUpdater.TARGET = String(BestWaifu.MZPeerUpdater.params["Installed Plugin File"] || "MZPeer.js");

BestWaifu.MZPeerUpdater.checked = false;

BestWaifu.MZPeerUpdater.enabled = function () {
    return Utils.isNwjs() && !Utils.isOptionValid("test") && BestWaifu.MZPeerUpdater.REPO.includes("/");
};

/** GET a URL with Node, following redirects (release assets redirect to a CDN). */
BestWaifu.MZPeerUpdater.get = function (url, redirects = 5) {
    const https = require("https");
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: { "User-Agent": "MZPeerUpdater", "Accept": "application/vnd.github+json" } }, response => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                response.resume();
                if (redirects <= 0) return reject(new Error("Too many redirects."));
                return resolve(BestWaifu.MZPeerUpdater.get(response.headers.location, redirects - 1));
            }
            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error("HTTP " + response.statusCode));
            }
            const chunks = [];
            response.on("data", c => chunks.push(c));
            response.on("end", () => resolve(Buffer.concat(chunks)));
        });
        request.setTimeout(10000, () => request.destroy(new Error("Timed out.")));
        request.on("error", reject);
    });
};

/** Compare dotted versions. Returns > 0 if a is newer than b. Accepts "v1.2.0" or "1" version types. */
BestWaifu.MZPeerUpdater.compare = function (a, b) {
    const parse = v => String(v).replace(/^v/i, "").split(".").map(n => parseInt(n) || 0);
    const pa = parse(a), pb = parse(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
};

/** Find the expected SHA-256 for the asset. Refuses to install without one. */
BestWaifu.MZPeerUpdater.expectedHash = function (release, asset) {
    if (asset.digest && asset.digest.startsWith("sha256:")) return asset.digest.slice(7).toLowerCase();
    const match = /sha256:\s*([a-f0-9]{64})/i.exec(release.body || "");
    return match ? match[1].toLowerCase() : null;
};

BestWaifu.MZPeerUpdater.install = async function (release, asset) {
    const fs = require("fs");
    const path = require("path");
    const crypto = require("crypto");

    const expected = this.expectedHash(release, asset);
    if (!expected) throw new Error("Release has no SHA-256 hash.");

    const data = await this.get(asset.browser_download_url);
    const actual = crypto.createHash("sha256").update(data).digest("hex");
    if (actual !== expected) throw new Error("Download failed its integrity check.");

    const root = path.dirname(process.mainModule.filename);
    const target = path.join(root, "js", "plugins", this.TARGET);
    const temp = target + ".download";

    fs.writeFileSync(temp, data);
    if (fs.existsSync(target)) fs.copyFileSync(target, target + ".bak"); // Rollback copy
    fs.renameSync(temp, target);
};

BestWaifu.MZPeerUpdater.check = async function () {
    if (this.checked || !this.enabled()) return;
    this.checked = true;
    try {
        const body = await this.get(`https://api.github.com/repos/${this.REPO}/releases/latest`);
        const release = JSON.parse(body.toString("utf8"));
        const current = BestWaifu.MZPeer ? BestWaifu.MZPeer.Version : 0;
        if (this.compare(release.tag_name, current) <= 0) return;

        const asset = (release.assets || []).find(a => a.name === this.ASSET);
        if (!asset) return;

        const ok = window.confirm(`Version ${release.tag_name} of the multiplayer plugin is available. Install it now? The game will restart.`);
        if (!ok) return;

        await this.install(release, asset);
        location.reload();
    } catch (e) {
        // Never block the game because of an update problem.
        console.warn("[MZPeerUpdater] Update check failed:", e.message);
    }
};

BestWaifu.MZPeerUpdater.Scene_Title_start = Scene_Title.prototype.start;
Scene_Title.prototype.start = function () {
    BestWaifu.MZPeerUpdater.Scene_Title_start.call(this);
    BestWaifu.MZPeerUpdater.check();
};