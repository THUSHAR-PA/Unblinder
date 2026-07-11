from ultralytics import YOLO
import cv2

# Load pretrained YOLO model
model = YOLO("yolo11n.pt")

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame)

    annotated = results[0].plot()

    objects = []

    for box in results[0].boxes:
    	cls = int(box.cls[0])
    	conf = float(box.conf[0])

    objects.append({
        "name": model.names[cls],
        "confidence": round(conf, 2)
    })

    print(objects)
    cv2.imshow("VisionGuide", annotated)

    if cv2.waitKey(1) == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()