package main

/*
#cgo CFLAGS: -x objective-c -Wno-deprecated-declarations
#cgo LDFLAGS: -framework Foundation -framework AppKit

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

void sendNotification(const char *title, const char *subtitle, const char *body) {
    @autoreleasepool {
        NSUserNotification *notification = [[NSUserNotification alloc] init];
        notification.title = [NSString stringWithUTF8String:title];
        if (subtitle && strlen(subtitle) > 0) {
            notification.subtitle = [NSString stringWithUTF8String:subtitle];
        }
        notification.informativeText = [NSString stringWithUTF8String:body];
        notification.soundName = NSUserNotificationDefaultSoundName;
        [[NSUserNotificationCenter defaultUserNotificationCenter] deliverNotification:notification];
    }
}
*/
import "C"

// notify sends a native macOS notification using NSUserNotificationCenter.
// The notification appears with Astra's app icon.
func notify(title, subtitle, message string) {
	C.sendNotification(C.CString(title), C.CString(subtitle), C.CString(message))
}
