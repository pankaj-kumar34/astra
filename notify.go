package main

/*
#cgo CFLAGS: -x objective-c -Wno-deprecated-declarations
#cgo LDFLAGS: -framework Foundation -framework UserNotifications

#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

void sendNotification(const char *title, const char *subtitle, const char *body) {
    @autoreleasepool {
        UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];

        // Request permission (no-op if already granted/denied)
        [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
            completionHandler:^(BOOL granted, NSError *error) {
                if (!granted) return;

                UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
                content.title = [NSString stringWithUTF8String:title];
                if (subtitle && strlen(subtitle) > 0) {
                    content.subtitle = [NSString stringWithUTF8String:subtitle];
                }
                content.body = [NSString stringWithUTF8String:body];
                content.sound = [UNNotificationSound defaultSound];
                // Request active interruption so it shows as a banner, not just in tray
                if (@available(macOS 12.0, *)) {
                    content.interruptionLevel = UNNotificationInterruptionLevelActive;
                }

                NSString *identifier = [[NSUUID UUID] UUIDString];
                UNNotificationRequest *request = [UNNotificationRequest
                    requestWithIdentifier:identifier
                    content:content
                    trigger:nil];

                [center addNotificationRequest:request withCompletionHandler:nil];
            }];
    }
}
*/
import "C"

// notify sends a native macOS notification using UNUserNotificationCenter.
func notify(title, subtitle, message string) {
	C.sendNotification(C.CString(title), C.CString(subtitle), C.CString(message))
}
