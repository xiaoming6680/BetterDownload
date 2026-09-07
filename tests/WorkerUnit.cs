using System;
using System.IO;
using NcmBetterDownload;
public static class WorkerUnit {
    public static int Main(string[] args) {
        string source = args[0], output = args[1];
        using (var handle = new FileStream(source, FileMode.Open, FileAccess.ReadWrite, FileShare.None)) {
            bool refused = false;
            try { Ncm.Extract(source, output, false, () => true); }
            catch (IOException) { refused = true; }
            if (!refused) throw new Exception("Locked source was read");
        }
        bool cancelled = false;
        try { Ncm.Extract(source, output, false, () => false); }
        catch (OperationCanceledException) { cancelled = true; }
        if (!cancelled) throw new Exception("Cancellation was ignored");
        if (Directory.GetFiles(Path.GetDirectoryName(output)).Length != 0) throw new Exception("Cancellation left output behind");
        bool changed = false;
        try { Ncm.Extract(source, output, false, () => true, "wrong signature"); }
        catch (IOException) { changed = true; }
        if (!changed) throw new Exception("Changed source was accepted");
        Console.WriteLine("File locking, cancellation cleanup, and changed-file checks passed.");
        return 0;
    }
}
