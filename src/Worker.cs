using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Threading;
using System.Web.Script.Serialization;

namespace NcmBetterDownload {
    public sealed class Job {
        public string id = "";
        public string source = "";
        public string target = "";
    }
    public sealed class Control {
        public string session = "";
        public long heartbeat;
        public bool enabled;
        public string state = "";
        public Job[] jobs = new Job[0];
    }
    public sealed class Receipt {
        public string signature;
        public string output;
        public long length;
    }
    public static class Worker {
        static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 };
        static readonly Encoding Utf8 = new UTF8Encoding(false);
        static readonly List<object> Events = new List<object>();
        static readonly HashSet<string> Acknowledged = new HashSet<string>();
        static readonly Dictionary<string, int> Attempts = new Dictionary<string, int>();
        static Dictionary<string, Receipt> Receipts = new Dictionary<string, Receipt>(StringComparer.OrdinalIgnoreCase);
        static string ControlPath, StatusPath, ReceiptPath, Session;
        static int Converted, Failed;
        static DateTime LastStatus, LastAlive;
        static object Activity;
        static string ActivityState = "", CurrentJob = "", CurrentPath = "";
        public static long Now() { return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds; }
        public static string Full(string path) { return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }
        public static void WriteJson(string path, object value) {
            string temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try {
                File.WriteAllText(temp, Json.Serialize(value), Utf8);
                if (File.Exists(path)) File.Replace(temp, path, null); else File.Move(temp, path);
            } finally { if (File.Exists(temp)) File.Delete(temp); }
        }
        static Control ReadControl() {
            for (int attempt = 0; ; attempt++) {
                try {
                    var result = Json.Deserialize<Control>(File.ReadAllText(ControlPath, Utf8));
                    if (result == null) throw new InvalidDataException("配置正在写入。");
                    return result;
                } catch { if (attempt >= 3) throw; Thread.Sleep(20); }
            }
        }
        static bool Alive() {
            try { var c = ReadControl(); return c.enabled && c.session == Session && Now() - c.heartbeat < 15000 && Now() >= c.heartbeat - 5000; }
            catch { return false; }
        }
        static bool ContinueConversion() {
            if (DateTime.UtcNow - LastAlive < TimeSpan.FromMilliseconds(100)) return true;
            LastAlive = DateTime.UtcNow; return Alive();
        }
        static void Report(string state, string message, string path = "", bool add = true, int percent = 0) {
            if (state == "converting" || state == "success" || state == "error" || (state == "stopped" && ActivityState == "converting")) {
                Activity = new { id = CurrentJob, state, message, path = path.Length > 0 ? path : CurrentPath, output = state == "success" ? path : "", percent = state == "success" ? 100 : percent };
                ActivityState = state;
            }
            if (add) {
                Events.Insert(0, new { time = Now(), state, message, path });
                if (Events.Count > 30) Events.RemoveAt(30);
            }
            WriteJson(StatusPath, new { session = Session, heartbeat = Now(), state, message, converted = Converted, failed = Failed, events = Events, activity = Activity, acknowledged = Acknowledged.ToArray() });
            LastStatus = DateTime.UtcNow;
        }
        public static void Validate(Job job) {
            if (String.IsNullOrEmpty(job.id) || String.IsNullOrEmpty(job.source) || !Path.IsPathRooted(job.source) || !Path.IsPathRooted(job.target)) throw new InvalidDataException("无效的下载任务。");
            string source = Full(job.source);
            if (!Path.GetExtension(source).Equals(".ncm", StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("任务不是 NCM 文件。");
            var parts = source.Split(Path.DirectorySeparatorChar);
            int vip = Array.FindIndex(parts, p => p.Equals("VipSongsDownload", StringComparison.OrdinalIgnoreCase));
            if (vip < 1 || parts.Skip(vip + 1).Take(parts.Length - vip - 2).Any(p => p.Equals("unlock", StringComparison.OrdinalIgnoreCase))) throw new InvalidDataException("只处理 VipSongsDownload 中的下载完成任务。");
            string expected = String.Join(Path.DirectorySeparatorChar.ToString(), parts.Take(vip + 1).Concat(new [] { "unlock" }).Concat(parts.Skip(vip + 1)));
            if (!Full(job.target).Equals(expected, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("输出必须位于 VipSongsDownload\\unlock。");
            for (var parent = new DirectoryInfo(Path.GetDirectoryName(source)); parent != null; parent = parent.Parent)
                if ((parent.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("源路径包含目录链接。");
            if ((File.GetAttributes(source) & FileAttributes.ReparsePoint) != 0) throw new IOException("源文件为链接。");
        }
        static void Process(Control control, bool once) {
            Acknowledged.IntersectWith((control.jobs ?? new Job[0]).Select(job => job.id));
            foreach (var job in control.jobs ?? new Job[0]) {
                if (!once && !Alive()) return;
                if (Acknowledged.Contains(job.id)) continue;
                CurrentJob = job.id; CurrentPath = job.source;
                try {
                    Validate(job);
                    var info = new FileInfo(job.source); string signature = info.Length + ":" + info.LastWriteTimeUtc.Ticks;
                    Receipt receipt;
                    if (Receipts.TryGetValue(job.source, out receipt) && receipt.signature == signature && File.Exists(receipt.output) && new FileInfo(receipt.output).Length == receipt.length) {
                        Acknowledged.Add(job.id); Report("success", "此下载已完成转换", receipt.output); continue;
                    }
                    Report("converting", "正在转换", job.source);
                    DateTime progressAt = DateTime.MinValue;
                    string saved = Ncm.Extract(job.source, job.target, true, once ? (Func<bool>)(() => true) : ContinueConversion, signature, (done, total) => {
                        if (DateTime.UtcNow - progressAt < TimeSpan.FromMilliseconds(200)) return;
                        progressAt = DateTime.UtcNow;
                        Report("converting", "正在转换", job.source, false, (int)Math.Min(98, done * 98 / total));
                    });
                    Receipts[job.source] = new Receipt { signature = signature, output = saved, length = new FileInfo(saved).Length };
                    WriteJson(ReceiptPath, Receipts);
                    Converted++; Acknowledged.Add(job.id); Attempts.Remove(job.id);
                    Report("success", "音频与歌曲信息已保存", saved);
                } catch (OperationCanceledException) { return; }
                catch (Exception error) {
                    int attempt; Attempts.TryGetValue(job.id, out attempt); Attempts[job.id] = ++attempt;
                    if (!once && error is IOException && attempt < 20) {
                        Report("converting", "等待客户端释放文件", job.source, false); return;
                    }
                    Failed++; Acknowledged.Add(job.id); Report("error", error.Message, job.source);
                }
            }
            if (DateTime.UtcNow - LastStatus > TimeSpan.FromSeconds(2)) Report("ready", "已就绪，等待下载完成", "", false);
        }
        public static int Main(string[] args) {
            ControlPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "control.json");
            bool once = args.Length == 2 && args[0] == "--once";
            if (once) ControlPath = Path.GetFullPath(args[1]);
            StatusPath = Path.Combine(Path.GetDirectoryName(ControlPath), "status.json");
            try {
                using (var singleton = new FileStream(Path.Combine(Path.GetDirectoryName(ControlPath), "worker.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None)) {
                    var initial = ReadControl(); Session = initial.session;
                    if (!once && !Alive()) return 0;
                    Directory.CreateDirectory(initial.state);
                    ReceiptPath = Path.Combine(initial.state, "receipts-v3.json");
                    if (File.Exists(ReceiptPath)) {
                        try { Receipts = new Dictionary<string, Receipt>(Json.Deserialize<Dictionary<string, Receipt>>(File.ReadAllText(ReceiptPath, Utf8)), StringComparer.OrdinalIgnoreCase); }
                        catch { Report("error", "转换记录无法读取，原文件仍被保留。"); }
                    }
                    Report("ready", "已就绪，等待下载完成");
                    do {
                        if (!once && !Alive()) break;
                        try { Process(ReadControl(), once); }
                        catch (Exception e) { Failed++; Report("error", e.Message); }
                        if (once) break;
                        Thread.Sleep(100);
                    } while (true);
                    if (once || ReadControl().session == Session) Report("stopped", "插件已关闭", "", false);
                    return Failed > 0 ? 1 : 0;
                }
            } catch (IOException) { return 2; }
            catch (Exception e) { try { Report("error", e.Message); } catch {} return 1; }
        }
    }
    public static class Ncm {
        static byte[] Read(BinaryReader reader, int count) {
            if (count < 0 || count > reader.BaseStream.Length - reader.BaseStream.Position) throw new InvalidDataException("NCM 文件不完整。");
            byte[] data = reader.ReadBytes(count);
            if (data.Length != count) throw new EndOfStreamException();
            return data;
        }
        static byte[] Block(BinaryReader r, int limit) {
            uint size = r.ReadUInt32();
            if (size > limit) throw new InvalidDataException("NCM 数据块长度异常。");
            return Read(r, (int)size);
        }
        static byte[] Aes(byte[] input, string key) {
            using (var aes = System.Security.Cryptography.Aes.Create()) {
                aes.Key = Encoding.ASCII.GetBytes(key); aes.Mode = CipherMode.ECB; aes.Padding = PaddingMode.PKCS7;
                using (var transform = aes.CreateDecryptor()) return transform.TransformFinalBlock(input, 0, input.Length);
            }
        }
        static string Unique(string target) {
            if (!File.Exists(target) && !Directory.Exists(target)) return target;
            string dir = Path.GetDirectoryName(target), stem = Path.GetFileNameWithoutExtension(target), ext = Path.GetExtension(target);
            for (int i = 2; i < 10000; i++) {
                string candidate = Path.Combine(dir, stem + " (" + i + ")" + ext);
                if (!File.Exists(candidate) && !Directory.Exists(candidate)) return candidate;
            }
            throw new IOException("同名文件过多。");
        }
        public static string Extract(string source, string target, bool embedMetadata, Func<bool> alive, string expectedSignature = null, Action<long, long> progress = null) {
            string temp = null;
            try {
                // Exclusive open refuses downloads that are still held open by the client.
                using (var file = new FileStream(source, FileMode.Open, FileAccess.Read, FileShare.None))
                using (var r = new BinaryReader(file)) {
                    if (expectedSignature != null && expectedSignature != file.Length + ":" + File.GetLastWriteTimeUtc(source).Ticks) throw new IOException("源文件发生变化，稍后重试。");
                    if (Encoding.ASCII.GetString(Read(r, 8)) != "CTENFDAM") throw new InvalidDataException("不是受支持的 NCM 文件。");
                    Read(r, 2);
                    byte[] encryptedKey = Block(r, 1024 * 1024);
                    for (int i = 0; i < encryptedKey.Length; i++) encryptedKey[i] ^= 0x64;
                    byte[] key = Aes(encryptedKey, "hzHRAmso5kInbaxW");
                    if (key.Length <= 17 || Encoding.ASCII.GetString(key, 0, 17) != "neteasecloudmusic") throw new InvalidDataException("NCM 音频密钥无效。");
                    byte[] box = Enumerable.Range(0, 256).Select(i => (byte)i).ToArray();
                    int j = 0;
                    for (int i = 0; i < 256; i++) { j = (j + box[i] + key[17 + i % (key.Length - 17)]) & 255; byte t = box[i]; box[i] = box[j]; box[j] = t; }
                    byte[] mask = new byte[256];
                    for (int i = 0; i < 256; i++) { int k = (i + 1) & 255; mask[i] = box[(box[k] + box[(box[k] + k) & 255]) & 255]; }
                    byte[] metadata = Block(r, 8 * 1024 * 1024);
                    byte[] plainMeta = new byte[0];
                    if (metadata.Length > 0) {
                        try {
                            for (int i = 0; i < metadata.Length; i++) metadata[i] ^= 0x63;
                            string text = Encoding.UTF8.GetString(metadata);
                            if (text.StartsWith("163 key(Don't modify):")) {
                                byte[] raw = Aes(Convert.FromBase64String(text.Substring(22)), "#14ljk_!\\]&0U<'(");
                                if (Encoding.UTF8.GetString(raw).StartsWith("music:")) plainMeta = raw.Skip(6).ToArray();
                            }
                        } catch (Exception e) { if (!(e is FormatException) && !(e is CryptographicException)) throw; }
                    }
                    Read(r, 5); // CRC field and image version; not a reliable audio completeness check.
                    uint coverSpace = r.ReadUInt32(), coverSize = r.ReadUInt32();
                    if (coverSize > coverSpace || coverSpace > 32 * 1024 * 1024 || coverSpace > file.Length - file.Position) throw new InvalidDataException("NCM 封面数据不完整。");
                    byte[] cover = Read(r, (int)coverSize);
                    file.Position += coverSpace - coverSize;
                    long audioLength = file.Length - file.Position;
                    if (audioLength < 4) throw new InvalidDataException("NCM 缺少音频数据。");
                    byte[] head = Read(r, 4);
                    for (int i = 0; i < head.Length; i++) head[i] ^= mask[i];
                    string format;
                    if (Encoding.ASCII.GetString(head) == "fLaC") format = ".flac";
                    else if (Encoding.ASCII.GetString(head, 0, 3) == "ID3" || (head[0] == 255 && (head[1] & 0xe0) == 0xe0 && (head[1] & 6) != 0 && (head[2] & 0xf0) != 0xf0)) format = ".mp3";
                    else throw new InvalidDataException("未识别到 FLAC / MP3 音频，文件可能损坏或格式不受支持。");
                    file.Position -= 4;
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    for (var parent = new DirectoryInfo(Path.GetDirectoryName(target)); parent != null; parent = parent.Parent)
                        if ((parent.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("输出路径包含目录链接。");
                    string dest = Unique(Path.ChangeExtension(target, format));
                    temp = dest + "." + Guid.NewGuid().ToString("N") + ".part";
                    using (var output = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                        byte[] buffer = new byte[64 * 1024]; long offset = 0; int count;
                        while ((count = file.Read(buffer, 0, buffer.Length)) > 0) {
                            if (!alive()) throw new OperationCanceledException();
                            for (int i = 0; i < count; i++) buffer[i] ^= mask[(int)((offset + i) & 255)];
                            output.Write(buffer, 0, count); offset += count;
                            if (progress != null) progress(offset, audioLength);
                        }
                        if (offset != audioLength) throw new IOException("音频读取长度发生变化。");
                        output.Flush(true);
                    }
                    if (!alive()) throw new OperationCanceledException();
                    if (embedMetadata) Metadata.Embed(temp, format, plainMeta, cover);
                    if (!alive()) throw new OperationCanceledException();
                    File.Move(temp, dest); temp = null;
                    return dest;
                }
            } finally { if (temp != null && File.Exists(temp)) File.Delete(temp); }
        }
    }
}
