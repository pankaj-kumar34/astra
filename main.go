package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	application.RegisterEvent[TunnelState]("tunnel:state")
}

func main() {
	svc := NewAstraService()

	app := application.New(application.Options{
		Name:        "Astra",
		Description: "IBM Cloud VPC Tunnel Manager",
		Services: []application.Service{
			application.NewService(svc),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	win := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     "Astra",
		Width:     1200,
		Height:    760,
		MinWidth:  900,
		MinHeight: 600,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 52,
			Backdrop:                application.MacBackdropNormal,
			TitleBar:                application.MacTitleBarHiddenInset,
			Appearance:              application.NSAppearanceNameAqua,
			// Disable fullscreen so green button maximises instead of going fullscreen
			CollectionBehavior: application.MacWindowCollectionBehaviorManaged |
				application.MacWindowCollectionBehaviorFullScreenNone,
		},
		MaximiseButtonState:   application.ButtonEnabled,
		FullscreenButtonState: application.ButtonEnabled,
		BackgroundColour:      application.NewRGB(244, 244, 245),
		URL:                   "/",
	})

	// Red button: hide instead of close (official pattern from Wails examples)
	win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()
		win.Hide()
	})

	// Dock icon click while window hidden → show and bring to front.
	// Focus() calls activateIgnoringOtherApps only when app is not active — correct here.
	app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(e *application.ApplicationEvent) {
		win.Show()
		win.Focus()
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
	// app.Run() returns on quit — kill all SSH processes so ports are freed
	svc.manager.DisconnectAll()
}
