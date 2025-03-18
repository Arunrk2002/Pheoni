import React, { useState, useContext } from "react";
import { BsThreeDotsVertical } from "react-icons/bs"; // Three-dot icon
import { IoArrowBack } from "react-icons/io5"; // Back arrow icon
import "./Sidebar.css";
import { datacontext } from "../context/UserContext"; // ✅ Import context

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkURL, setLinkURL] = useState("");

  const { savedLinks, addLink, removeLink } = useContext(datacontext); // ✅ Get removeLink

  const handleAddLink = () => {
    if (linkName.trim() === "" || linkURL.trim() === "") return;
    addLink(linkName, linkURL);
    setLinkName("");
    setLinkURL("");
  };

  return (
    <div>
      {/* Sidebar Toggle Button - Three Dots */}
      <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
        <BsThreeDotsVertical size={24} />
      </button>

      {/* Sidebar Menu */}
      <div className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Back Button (Only Icon) */}
        <button className="back-button" onClick={() => setIsOpen(false)}>
          <IoArrowBack size={24} />
        </button>

        <h3>Saved Links</h3>
        <ul>
          {savedLinks.map((link, index) => (
            <li key={index} className="link-item">
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.name}
              </a>
              <button className="delete-btn" onClick={() => removeLink(link.name)}>
                ❌
              </button>
            </li>
          ))}
        </ul>

        {/* Add New Link */}
        <div className="add-link">
          <input
            type="text"
            placeholder="Link Name"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
          />
          <input
            type="text"
            placeholder="URL"
            value={linkURL}
            onChange={(e) => setLinkURL(e.target.value)}
          />
          <button onClick={handleAddLink}>Add Link</button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
