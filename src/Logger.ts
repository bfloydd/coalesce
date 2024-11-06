export class Logger {
    private static enabled: boolean = true;

    static enable() {
        Logger.enabled = true;
    }

    static disable() {
        Logger.enabled = false;
    }

    info(message?: any, ...optionalParams: any[]) {
        if (Logger.enabled) {
            console.log(message, ...optionalParams);
        }
    }

    warn(message?: any, ...optionalParams: any[]) {
        if (Logger.enabled) {
            console.warn(message, ...optionalParams);
        }
    }

    debug(message?: any, ...optionalParams: any[]) {
        if (Logger.enabled) {
            console.debug(message, ...optionalParams);
        }
    }
}