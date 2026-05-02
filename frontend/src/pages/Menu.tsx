import { motion } from "framer-motion";
import { LuScissors } from "react-icons/lu";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export default function Menu() {
  return (
    <motion.div
      className="editor-placeholder"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="editor-placeholder-icon">
        <LuScissors size={34} strokeWidth={1.4} />
      </motion.div>
      <motion.div variants={item} className="editor-placeholder-title">
        Video Editor
      </motion.div>
      <motion.div variants={item} className="editor-placeholder-desc">
        Trim, cut, and refine your clips — coming soon.
      </motion.div>
    </motion.div>
  );
}
