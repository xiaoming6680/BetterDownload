using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace NcmBetterDownload {
    public static class Metadata {
        static string Text(Dictionary<string, object> data, string key) {
            object value; return data.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : "";
        }
        public static void Embed(string path, string format, byte[] json, byte[] cover) {
            Dictionary<string, object> info = new Dictionary<string, object>();
            if (json.Length > 0) info = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 }.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(json)) ?? info;
            using (var audio = TagLib.File.Create(path, format == ".flac" ? "taglib/flac" : "taglib/mp3", TagLib.ReadStyle.Average)) {
                string title = Text(info, "musicName"), album = Text(info, "album");
                if (title.Length > 0) audio.Tag.Title = title;
                if (album.Length > 0) audio.Tag.Album = album;
                object artists;
                if (info.TryGetValue("artist", out artists) && artists is IEnumerable) {
                    var names = new List<string>();
                    foreach (object artist in (IEnumerable)artists) {
                        var pair = artist as IList;
                        if (pair != null && pair.Count > 0 && pair[0] is string) names.Add((string)pair[0]);
                    }
                    if (names.Count > 0) audio.Tag.Performers = names.ToArray();
                }
                uint track; if (UInt32.TryParse(Text(info, "track"), out track) && track > 0) audio.Tag.Track = track;
                if (cover.Length > 0) {
                    string mime;
                    if (cover.Length >= 8 && cover[0] == 137 && Encoding.ASCII.GetString(cover, 1, 3) == "PNG") mime = "image/png";
                    else if (cover.Length >= 3 && cover[0] == 255 && cover[1] == 216) mime = "image/jpeg";
                    else throw new InvalidDataException("封面图片格式无法识别。");
                    var picture = new TagLib.Picture(new TagLib.ByteVector(cover)) { Type = TagLib.PictureType.FrontCover, MimeType = mime, Description = "Cover" };
                    // Preserve other embedded pictures, replace only the front cover.
                    audio.Tag.Pictures = audio.Tag.Pictures.Where(p => p.Type != TagLib.PictureType.FrontCover).Concat(new TagLib.IPicture[] { picture }).ToArray();
                }
                audio.Save();
            }
            // Verify persistence before committing the final filename.
            using (var check = TagLib.File.Create(path, format == ".flac" ? "taglib/flac" : "taglib/mp3", TagLib.ReadStyle.Average)) {
                if (cover.Length > 0 && !check.Tag.Pictures.Any(p => p.Type == TagLib.PictureType.FrontCover && p.Data.Data.SequenceEqual(cover))) throw new IOException("封面写入验证失败。");
                string title = Text(info, "musicName");
                if (title.Length > 0 && check.Tag.Title != title) throw new IOException("歌曲标签写入验证失败。");
            }
        }
    }
}
