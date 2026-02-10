# Log Analyzer Server

## Overview

The **log-analyzer** server provides tools for analyzing application log files.
The problem it solves is universal: log files grow rapidly, contain
thousands of lines, and identifying error patterns, anomalies, or trends requires time
and specific expertise.

This server automates the analysis, supporting both plain text logs
and structured logs in JSON format (NDJSON). Each tool is stateless and operates
directly on the filesystem.

```
+------------------------------------------------------------+
|               log-analyzer server                          |
|                                                            |
|  +-------------------------------------------------------+ |
|  |                  Tool Layer                           | |
|  |                                                       | |
|  |  analyze-log-file   find-error-patterns               | |
|  |  tail-log           generate-summary                  | |
|  +-------------------------------------------------------+ |
|                         |                                  |
|                         v                                  |
|  +-------------------------------------------------------+ |
|  |           fs/promises (readFile)                      | |
|  |                                                       | |
|  |  Supported formats:                                   | |
|  |  - Plain text (syslog, Apache, custom)                | |
|  |  - JSON lines (NDJSON, structured logging)            | |
|  |  - Auto-detection based on sampling                   | |
|  +-------------------------------------------------------+ |
+------------------------------------------------------------+
```

### Key Features

- **Format auto-detection**: sampling the first 10 lines to decide if JSON or plain text
- **Multi-format timestamps**: ISO 8601, Common Log Format, Syslog, generic date-time
- **Pattern normalization**: substitution of UUIDs, IPs, numbers, URLs to group similar errors
- **No events, no store**: purely stateless and on-demand analysis

---

## Tool Table

| Tool | Description | Parameters |
|------|-------------|-----------|
| `analyze-log-file` | Analyzes a log file: count by level, error extraction, time range | `filePath` (string); `format?` (enum: auto, json, plain) |
| `find-error-patterns` | Finds recurring error patterns by grouping similar messages | `filePath` (string); `minCount?` (number, default: 2) |
| `tail-log` | Returns the last N lines of a log file with optional filter | `filePath` (string); `lines?` (number, default: 50); `filter?` (string) |
| `generate-summary` | Generates a readable summary with counts, health indicators, and top errors | `filePath` (string) |

---

## Architecture

### Format Recognition

```
  Log file
      |
      v
  Sample first 10 lines
      |
      v
  Does each line start with '{' and parse as JSON?
      |
  +---+---+
  |       |
  v       v
 JSON   Plain text
  |       |
  v       v
  parseJsonLine()    extractLogLevel()
  - obj.level        - regex: ERROR|WARN|INFO|DEBUG|...
  - obj.message      extractTimestamp()
  - obj.timestamp    - ISO 8601
                     - Common Log Format
                     - Syslog
                     - Generic date-time
```

### Supported Timestamp Patterns

| Format | Example | Pattern |
|--------|---------|---------|
| ISO 8601 | `2024-01-15T10:30:00.000Z` | `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}` |
| Common Log | `15/Jan/2024:10:30:00 +0000` | `\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2}` |
| Syslog | `Jan 15 10:30:00` | `\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2}` |
| Date-time | `2024-01-15 10:30:00` | `\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}` |

### Recognized Log Levels

`ERROR`, `WARN` (WARNING), `INFO`, `DEBUG`, `TRACE`, `FATAL`, `CRITICAL`, `NOTICE`

### Error Normalization (find-error-patterns)

The `find-error-patterns` tool normalizes error messages to group
occurrences of the same problem with different data:

| Element | Substitution | Example |
|---------|-------------|---------|
| Timestamp | `<TIMESTAMP>` | `2024-01-15T10:30:00Z` -> `<TIMESTAMP>` |
| UUID | `<UUID>` | `550e8400-e29b-41d4-a716-446655440000` -> `<UUID>` |
| Hexadecimal hash | `<HEX>` | `a1b2c3d4e5f6` -> `<HEX>` |
| IP address | `<IP>` | `192.168.1.1:3000` -> `<IP>` |
| URL | `<URL>` | `https://api.example.com/v1` -> `<URL>` |
| File path | `<PATH>` | `/var/log/app/error.log` -> `<PATH>` |
| Numbers | `<NUM>` | `42`, `1024` -> `<NUM>` |
| Quoted strings | `"<STR>"` | `"user not found"` -> `"<STR>"` |

### Flow of generate-summary

```
  Log file
      |
      v
  Parse all lines (JSON or plain)
      |
      +-- Count by level
      |
      +-- Time range extraction (first/last timestamp)
      |
      +-- Error message collection
      |
      +-- Indicator calculation:
      |     - Error rate = errors / total * 100
      |     - Warning rate = warnings / total * 100
      |
      +-- Top 5 errors by frequency
      |
      v
  Formatted text output:

  Log File Summary: /path/to/file.log
  ==================================================

  Total lines: 15234

  Log Level Breakdown:
    ERROR: 42 (0.3%)
    WARN: 156 (1.0%)
    INFO: 14836 (97.4%)
    DEBUG: 200 (1.3%)

  Time Range:
    Earliest: 2024-01-15T00:00:01Z
    Latest:   2024-01-15T23:59:58Z

  Health Indicators:
    Error rate: 0.3%
    Warning rate: 1.0%

  Top Error Messages:
    1. [15x] Connection timeout to database
    2. [12x] Failed to parse request body
    3. [8x]  Authentication token expired
```

---

## Event Bus Integration

This server **neither publishes nor subscribes to events**. It operates in a
purely on-demand mode analyzing files from the local filesystem.

---

## Interactions with Other Servers

| Related Server | Direction | Description |
|----------------|-----------|-------------|
| `cicd-monitor` | complementary | Build logs can be analyzed after download |
| `docker-compose` | complementary | Docker container logs can be analyzed |
| `environment-manager` | complementary | Environment variables affect the logging level |
| `performance-profiler` | complementary | Performance logs can be correlated with profiling |

---

## Usage Examples

### Log file analysis

**Request:**
```json
{
  "tool": "analyze-log-file",
  "arguments": {
    "filePath": "/var/log/app/application.log",
    "format": "auto"
  }
}
```

**Response:**
```json
{
  "totalLines": 5420,
  "levels": { "INFO": 5100, "WARN": 250, "ERROR": 65, "DEBUG": 5 },
  "topErrors": [
    { "message": "Connection refused to redis:6379", "count": 30 },
    { "message": "Request timeout after 30000ms", "count": 20 }
  ],
  "timeRange": {
    "earliest": "2024-06-15T08:00:01.234Z",
    "latest": "2024-06-15T18:45:30.567Z"
  }
}
```

### Error pattern search

**Request:**
```json
{
  "tool": "find-error-patterns",
  "arguments": {
    "filePath": "/var/log/app/application.log",
    "minCount": 3
  }
}
```

**Response:**
```json
{
  "totalPatternsFound": 4,
  "minCount": 3,
  "patterns": [
    {
      "pattern": "Connection refused to <IP>",
      "count": 30,
      "examples": [
        "Connection refused to 10.0.0.5:6379",
        "Connection refused to 10.0.0.5:6380"
      ]
    },
    {
      "pattern": "Request timeout after <NUM>ms for <URL>",
      "count": 20,
      "examples": [
        "Request timeout after 30000ms for https://api.external.com/v1/users"
      ]
    }
  ]
}
```

### Tail with filter

**Request:**
```json
{
  "tool": "tail-log",
  "arguments": {
    "filePath": "/var/log/app/application.log",
    "lines": 20,
    "filter": "ERROR"
  }
}
```

**Response:**
```
2024-06-15T18:30:00Z ERROR Connection refused to redis:6379
2024-06-15T18:35:12Z ERROR Request timeout after 30000ms
...
```

---

## Future Developments

- **Streaming / watch mode**: real-time monitoring of log files with `fs.watch`
- **Multi-file correlation**: cross-analysis of logs from different services
- **Anomaly detection**: automatic identification of error spikes
- **Additional format support**: Apache access log, nginx, systemd journal
- **Compression**: support for `.gz` and `.bz2` files
- **Event Bus integration**: publishing `log:anomaly-detected` for automatic alerts
- **Advanced filters**: time ranges, regular expressions, multiple levels
- **Graphical output**: ASCII histograms of error distribution over time
