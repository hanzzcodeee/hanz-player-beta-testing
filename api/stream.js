const ytdl = require("@distube/ytdl-core");

module.exports = async (req, res) => {
  // support: /api/stream?id=VIDEO_ID  OR /api/stream?id=https://youtube.com/watch?v=...
  const raw = (req.query?.id || req.query?.url || "").toString().trim();
  if (!raw) return res.status(400).send("missing id");

  const videoUrl = raw.startsWith("http")
    ? raw
    : `https://www.youtube.com/watch?v=${raw}`;

  try {
    // cek valid
    if (!ytdl.validateURL(videoUrl)) {
      return res.status(400).send("invalid youtube url/id");
    }

    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    });

    const format = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    if (!format || !format.url) {
      return res.status(404).send("no audio format");
    }

    const mimeType = (format.mimeType || "audio/mp4").split(";")[0];

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Accept-Ranges", "bytes");

    // Range support (penting buat <audio>)
    const range = req.headers.range;
    if (range) res.statusCode = 206;

    const stream = ytdl(videoUrl, {
      quality: "highestaudio",
      filter: "audioonly",
      format,
      highWaterMark: 1 << 25,
      requestOptions: {
        headers: {
          ...(range ? { Range: range } : {}),
        },
      },
    });

    req.on("close", () => stream.destroy());

    stream.on("error", (e) => {
      console.error("ytdl stream error:", e);
      if (!res.headersSent) res.status(500).end("stream error");
      else res.end();
    });

    stream.pipe(res);
  } catch (e) {
    console.error("stream error:", e);
    res.status(500).send("blocked / stream failed");
  }
};
