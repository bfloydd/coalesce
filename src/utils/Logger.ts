export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export class Logger {
    private enabled: boolean = false;
    private level: LogLevel = LogLevel.INFO;

    static parseLogLevel(level: string | boolean): LogLevel | boolean {
        if (typeof level === 'boolean') {
            return level;
        }

        const normalizedLevel = level.toUpperCase();
        switch (normalizedLevel) {
            case 'DEBUG': return LogLevel.DEBUG;
            case 'INFO': return LogLevel.INFO;
            case 'WARN': return LogLevel.WARN;
            case 'ERROR': return LogLevel.ERROR;
            case 'NONE': return LogLevel.NONE;
            default: return LogLevel.INFO;
        }
    }

    setLogging(level: string | boolean) {
        console.log('setLogging called with:', level);
        const parsedLevel = Logger.parseLogLevel(level);
        console.log('parsed level:', parsedLevel);
        
        if (typeof parsedLevel === 'boolean') {
            this.enabled = parsedLevel;
            this.level = LogLevel.INFO;
            console.log(`Logging ${parsedLevel ? 'enabled' : 'disabled'} (level: ${LogLevel[this.level]})`);
            console.log('Current state:', { enabled: this.enabled, level: this.level });
        } else {
            this.enabled = true;
            this.level = parsedLevel;
            console.log(`Logging level set to ${LogLevel[this.level]}`);
            console.log('Current state:', { enabled: this.enabled, level: this.level });
        }
    }

    /**********************************************************
     * Primary debug levels
     *********************************************************/

    debug(message?: any, ...optionalParams: any[]) {
        if (this.enabled && this.level <= LogLevel.DEBUG) {
            console.debug(message, ...optionalParams);
        }
    }

    info(message?: any, ...optionalParams: any[]) {
        if (this.enabled && this.level <= LogLevel.INFO) {
            console.log(message, ...optionalParams);
        }
    }

    warn(message?: any, ...optionalParams: any[]) {
        if (this.enabled && this.level <= LogLevel.WARN) {
            console.warn(message, ...optionalParams);
        }
    }

    error(message?: any, ...optionalParams: any[]) {
        if (this.enabled && this.level <= LogLevel.ERROR) {
            console.error(message, ...optionalParams);
        }
    }

    /**********************************************************
     * Extras
     *********************************************************/

    trace(message?: any, ...optionalParams: any[]) {
        if (this.enabled) {
            console.trace(message, ...optionalParams);
        }
    }

    group(label?: string) {
        if (this.enabled) {
            console.group(label);
        }
    }

    groupEnd() {
        if (this.enabled) {
            console.groupEnd();
        }
    }

    table(tabularData: any, properties?: string[]) {
        if (this.enabled) {
            console.table(tabularData, properties);
        }
    }

    time(label: string) {
        if (this.enabled) {
            console.time(label);
        }
    }

    timeEnd(label: string) {
        if (this.enabled) {
            console.timeEnd(label);
        }
    }
}