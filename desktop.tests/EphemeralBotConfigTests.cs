using System;
using System.Collections.Generic;
using System.IO;
using WorldDownloaderManager;
using Xunit;

namespace WorldDownloaderManager.Tests;

public sealed class EphemeralBotConfigTests
{
    [Fact]
    public void DisposeRemovesThePlaintextConfiguration()
    {
        var directory = CreateSandbox();
        try
        {
            var config = EphemeralBotConfig.Create(
                new Dictionary<string, object?> { ["loginPassword"] = "synthetic-secret" }, directory);
            var path = config.Path;

            Assert.True(File.Exists(path));
            config.Dispose();

            Assert.False(File.Exists(path));
        }
        finally
        {
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public void FailedWriteDisposesAndDeletesThePartialPlaintextFile()
    {
        var directory = CreateSandbox();
        string? attemptedPath = null;
        try
        {
            Assert.Throws<IOException>(() => EphemeralBotConfig.Create(
                new Dictionary<string, object?> { ["loginPassword"] = "synthetic-secret" },
                directory,
                path =>
                {
                    attemptedPath = path;
                    return new FailingWriteStream(new FileStream(
                        path, FileMode.CreateNew, FileAccess.Write, FileShare.Read | FileShare.Delete));
                }));

            Assert.NotNull(attemptedPath);
            Assert.False(File.Exists(attemptedPath));
            Assert.Empty(Directory.EnumerateFiles(directory));
        }
        finally
        {
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    private static string CreateSandbox()
    {
        var path = Path.Combine(Path.GetTempPath(), "mwd-bot-config-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private sealed class FailingWriteStream : Stream
    {
        private readonly Stream _inner;
        public FailingWriteStream(Stream inner) => _inner = inner;
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => _inner.Length;
        public override long Position { get => _inner.Position; set => throw new NotSupportedException(); }
        public override void Flush() => _inner.Flush();
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => _inner.SetLength(value);
        public override void Write(byte[] buffer, int offset, int count)
        {
            _inner.Write(buffer, offset, Math.Min(count, 1));
            throw new IOException("Synthetic write failure.");
        }
        protected override void Dispose(bool disposing)
        {
            if (disposing) _inner.Dispose();
            base.Dispose(disposing);
        }
    }
}
