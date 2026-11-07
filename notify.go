package main

/*
#cgo CFLAGS: -x objective-c -Wno-deprecated-declarations
#cgo LDFLAGS: -framework Foundation -framework UserNotifications

#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>

void sendNotification(const char *title, const char *subtitle, const char *body) {
    // Copy strings before async dispatch
    NSString *nsTitle    = [NSString stringWithUTF8String:title];
    NSString *nsSubtitle = (subtitle && strlen(subtitle) > 0) ? [NSString stringWithUTF8String:subtitle] : nil;
    NSString *nsBody     = [NSString stringWithUTF8String:body];

    dispatch_async(dispatch_get_main_queue(), ^{
        @autoreleasepool {
            UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
            [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                completionHandler:^(BOOL granted, NSError *error) {
                    if (!granted) return;

                    UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
                    content.title = nsTitle;
                    if (nsSubtitle) content.subtitle = nsSubtitle;
                    content.body  = nsBody;
                    content.sound = [UNNotificationSound defaultSound];
                    if (@available(macOS 12.0, *)) {
                        content.interruptionLevel = UNNotificationInterruptionLevelActive;
                    }

                    UNNotificationRequest *request = [UNNotificationRequest
                        requestWithIdentifier:[[NSUUID UUID] UUIDString]
                        content:content
                        trigger:nil];
                    [center addNotificationRequest:request withCompletionHandler:nil];
                }];
        }
    });
}
*/
import "C"

// notify sends a native macOS notification using UNUserNotificationCenter.
func notify(title, subtitle, message string) {
	C.sendNotification(C.CString(title), C.CString(subtitle), C.CString(message))
}
