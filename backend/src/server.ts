
import app from "./app";
import "./workers/thumbnail.worker";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`DeskOps server running on port ${PORT}`);
});
