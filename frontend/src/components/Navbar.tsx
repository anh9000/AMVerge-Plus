import React from "react"
import Logo from "../assets/AMverge_logo.png"

type NavbarProps = {
    setSideBarEnabled: React.Dispatch<React.SetStateAction<boolean>>
    userHasHEVC: React.RefObject<boolean>
}
export default function Navbar({ setSideBarEnabled, userHasHEVC }: NavbarProps ) {
    setSideBarEnabled(true) // just putting this here to remove error
    return (
        <div className="navbar">
            {/* <svg onClick={() =>setSideBarEnabled(prev => !prev )} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_429_11066)">
                    <path d="M3 6.00092H21M3 12.0009H21M3 18.0009H21" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                <defs>
                <clipPath id="clip0_429_11066">
                    <rect width="24" height="24" fill="white" transform="translate(0 0.000915527)"/>
                </clipPath>
                </defs>
             </svg> */}
            <img src={Logo}></img>

            <div className="hevc-check">
                <p>user has hevc: {userHasHEVC.current ? "true" : "false"}</p>
            </div>
        </div>
    )
}