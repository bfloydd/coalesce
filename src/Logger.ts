export class Logger {
    private static enabled: boolean = false;

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
}