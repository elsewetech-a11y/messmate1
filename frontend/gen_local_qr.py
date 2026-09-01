import qrcode

def generate_qr():
    url = "https://new-bats-smoke.loca.lt/app-debug.apk"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    artifact_path = r"C:\Users\kames\.gemini\antigravity-ide\brain\f14889b4-d3b0-4a94-bc8f-6e79d89a3421\apk_qr.png"
    img.save(artifact_path)
    print(f"Saved QR code to {artifact_path}")

if __name__ == "__main__":
    generate_qr()
